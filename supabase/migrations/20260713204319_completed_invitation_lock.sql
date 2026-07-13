-- Completed invitation immutability and pre-completion edit freedom.

create or replace function public.vilique_parse_invitation_time(value text, fallback_value time)
returns time
language plpgsql
immutable
as $$
declare
  matched text[];
  hours integer;
  minutes integer;
  period text;
begin
  matched := regexp_match(coalesce(value, ''), '(\d{1,2}):(\d{2})\s*(AM|PM)?', 'i');

  if matched is null then
    return fallback_value;
  end if;

  hours := matched[1]::integer;
  minutes := matched[2]::integer;
  period := upper(coalesce(matched[3], ''));

  if period = 'PM' and hours < 12 then
    hours := hours + 12;
  elsif period = 'AM' and hours = 12 then
    hours := 0;
  end if;

  if hours < 0 or hours > 23 or minutes < 0 or minutes > 59 then
    return fallback_value;
  end if;

  return make_time(hours, minutes, 0);
end;
$$;

create or replace function public.vilique_event_completed(
  event_date date,
  event_time text,
  event_timezone text,
  reference_time timestamptz default now()
)
returns boolean
language plpgsql
stable
as $$
declare
  parts text[];
  raw_start text;
  raw_end text;
  end_time time;
  local_now timestamp;
  local_end timestamp;
begin
  if event_date is null then
    return false;
  end if;

  parts := regexp_split_to_array(coalesce(event_time, ''), '\s*[-–—]\s*');
  raw_start := coalesce(parts[1], '');
  raw_end := coalesce(nullif(parts[2], ''), raw_start);
  end_time := public.vilique_parse_invitation_time(raw_end, time '23:59:59');
  local_now := reference_time at time zone coalesce(nullif(event_timezone, ''), 'Asia/Kolkata');
  local_end := event_date::timestamp + end_time;

  return local_now > local_end;
end;
$$;

create or replace function public.vilique_is_completed_invitation(invite public.invitations)
returns boolean
language sql
stable
as $$
  select invite.lifecycle_status = 'completed'
      or invite.event_status = 'completed'
      or public.vilique_event_completed(invite.event_date, invite.event_time, invite.event_timezone);
$$;

create or replace function public.vilique_assess_event_identity_change(snapshot jsonb, proposed jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  score integer := 0;
  signals text[] := array[]::text[];
  original_category text := snapshot->>'original_category';
  original_primary_name text := snapshot->>'original_primary_name';
  original_secondary_name text := coalesce(snapshot->>'original_secondary_name', '');
  original_event_date text := snapshot->>'original_event_date';
  original_template_id text := coalesce(snapshot->>'original_template_id', '');
  original_venue text := trim(concat_ws(' ', snapshot->>'original_venue_name', snapshot->>'original_venue_address'));
  proposed_category text := proposed->>'category';
  proposed_primary_name text := proposed->>'primaryName';
  proposed_secondary_name text := coalesce(proposed->>'secondaryName', '');
  proposed_event_date text := proposed->>'eventDate';
  proposed_template_id text := coalesce(proposed->>'templateId', '');
  proposed_venue text := trim(concat_ws(' ', proposed->>'venueName', proposed->>'venueAddress'));
  similarity numeric;
  date_diff integer;
  risk_level text := 'low';
  decision text := 'allowed';
  reason text := 'Changes classify as same-event corrections or legitimate rescheduling.';
begin
  if proposed_category is not null and proposed_category <> original_category then
    if (original_category = 'wedding' and proposed_category = 'engagement')
       or (original_category = 'engagement' and proposed_category = 'wedding')
       or (original_category = 'party' and proposed_category = 'birthday')
       or (original_category = 'birthday' and proposed_category = 'party') then
      score := score + 30;
    else
      score := score + 55;
    end if;
    signals := array_append(signals, 'Category changed.');
  end if;

  similarity := public.vilique_token_similarity(
    concat_ws(' ', original_primary_name, original_secondary_name),
    concat_ws(' ', proposed_primary_name, proposed_secondary_name)
  );

  if similarity < 0.2 then
    score := score + 45;
    signals := array_append(signals, 'Host/couple names appear completely replaced.');
  elsif similarity < 0.55 then
    score := score + 25;
    signals := array_append(signals, 'Host/couple names changed significantly.');
  elsif similarity < 0.9 then
    score := score + 8;
    signals := array_append(signals, 'Host/couple names changed slightly.');
  end if;

  if proposed_event_date is not null and proposed_event_date <> original_event_date then
    date_diff := public.vilique_date_diff_days(original_event_date, proposed_event_date);
    if date_diff is not null then
      if date_diff > 365 then
        score := score + 28;
        signals := array_append(signals, 'Event date moved by more than one year.');
      elsif date_diff > 180 then
        score := score + 22;
        signals := array_append(signals, 'Event date moved by more than six months.');
      elsif date_diff > 90 then
        score := score + 12;
        signals := array_append(signals, 'Event date moved by more than three months.');
      elsif date_diff > 30 then
        score := score + 5;
        signals := array_append(signals, 'Event date moved by more than one month.');
      end if;
    end if;
  end if;

  if original_venue <> '' and proposed_venue <> '' then
    similarity := public.vilique_token_similarity(original_venue, proposed_venue);
    if similarity < 0.2 then
      score := score + 22;
      signals := array_append(signals, 'Venue appears completely replaced.');
    elsif similarity < 0.5 then
      score := score + 10;
      signals := array_append(signals, 'Venue changed significantly.');
    end if;
  end if;

  if proposed_template_id <> '' and proposed_template_id <> original_template_id then
    score := score + 20;
    signals := array_append(signals, 'Template changed after first publish.');
  end if;

  if cardinality(signals) >= 3 then
    score := score + 10;
  end if;

  if cardinality(signals) >= 4 then
    score := score + 10;
  end if;

  if score >= 70 then
    risk_level := 'high';
    decision := 'warned';
    reason := 'This looks like a major update to your invitation.';
  elsif score >= 35 then
    risk_level := 'medium';
    decision := 'warned';
    reason := 'This looks like a major update to your invitation.';
  end if;

  return jsonb_build_object(
    'riskLevel', risk_level,
    'decision', decision,
    'score', score,
    'reason', reason,
    'signals', to_jsonb(signals)
  );
end;
$$;

create or replace function public.prevent_completed_invitation_update()
returns trigger
language plpgsql
security definer
as $$
declare
  bypass text := coalesce(current_setting('app.completed_lock_bypass', true), '');
  was_completed boolean;
  is_marking_completed boolean;
begin
  if bypass = 'on' then
    return new;
  end if;

  was_completed := public.vilique_is_completed_invitation(old);
  is_marking_completed :=
    not (old.lifecycle_status = 'completed' or old.event_status = 'completed')
    and public.vilique_event_completed(old.event_date, old.event_time, old.event_timezone)
    and new.lifecycle_status = 'completed'
    and new.event_status = 'completed'
    and new.status is not distinct from old.status
    and new.event_date is not distinct from old.event_date
    and new.event_time is not distinct from old.event_time
    and new.event_timezone is not distinct from old.event_timezone
    and new.category is not distinct from old.category
    and new.title is not distinct from old.title
    and new.primary_name is not distinct from old.primary_name
    and new.secondary_name is not distinct from old.secondary_name
    and new.venue_name is not distinct from old.venue_name
    and new.venue_address is not distinct from old.venue_address
    and new.map_link is not distinct from old.map_link
    and new.phone is not distinct from old.phone
    and new.whatsapp is not distinct from old.whatsapp
    and new.message is not distinct from old.message
    and new.template_id is not distinct from old.template_id
    and new.theme is not distinct from old.theme
    and new.sections is not distinct from old.sections
    and new.cover_image_url is not distinct from old.cover_image_url
    and new.gallery_urls is not distinct from old.gallery_urls
    and new.music_url is not distinct from old.music_url
    and new.slug is not distinct from old.slug
    and new.published_at is not distinct from old.published_at
    and new.first_published_at is not distinct from old.first_published_at;

  if was_completed and not is_marking_completed then
    raise exception 'Completed invitations cannot be edited or reactivated.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists lock_completed_invitation_update on public.invitations;
create trigger lock_completed_invitation_update
before update on public.invitations
for each row execute function public.prevent_completed_invitation_update();

create or replace function public.prevent_event_identity_bypass()
returns trigger
language plpgsql
security definer
as $$
declare
  checked text := coalesce(current_setting('app.identity_checked', true), '');
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if tg_op = 'UPDATE'
     and old.first_published_at is null
     and new.first_published_at is null
     and checked <> 'on'
     and (
       new.identity_snapshot is distinct from old.identity_snapshot
       or new.event_snapshot is distinct from old.event_snapshot
       or new.identity_fingerprint is distinct from old.identity_fingerprint
       or new.original_category is distinct from old.original_category
       or new.original_primary_name is distinct from old.original_primary_name
       or new.original_secondary_name is distinct from old.original_secondary_name
       or new.original_event_date is distinct from old.original_event_date
       or new.original_template_id is distinct from old.original_template_id
       or new.first_payment_id is distinct from old.first_payment_id
       or new.first_publish_version is distinct from old.first_publish_version
     ) then
    raise exception 'Protected event identity fields cannot be changed.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE'
     and old.first_published_at is null
     and new.first_published_at is not null
     and checked <> 'on'
     and jwt_role <> 'service_role' then
    raise exception 'Published event identity must be created by the server.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and old.first_published_at is not null then
    if btrim(coalesce(new.title, '')) = ''
       or btrim(coalesce(new.primary_name, '')) = ''
       or new.event_date is null
       or btrim(coalesce(new.event_time, '')) = ''
       or btrim(coalesce(new.venue_name, '')) = ''
       or btrim(coalesce(new.message, '')) = '' then
      raise exception 'Published invitations require title, primary name, date, time, venue name, and message.'
        using errcode = 'P0001';
    end if;

    if new.identity_snapshot is distinct from old.identity_snapshot
       or new.event_snapshot is distinct from old.event_snapshot
       or new.identity_fingerprint is distinct from old.identity_fingerprint
       or new.original_category is distinct from old.original_category
       or new.original_primary_name is distinct from old.original_primary_name
       or new.original_secondary_name is distinct from old.original_secondary_name
       or new.original_event_date is distinct from old.original_event_date
       or new.original_template_id is distinct from old.original_template_id
       or new.first_published_at is distinct from old.first_published_at
       or new.first_payment_id is distinct from old.first_payment_id
       or new.first_publish_version is distinct from old.first_publish_version then
      raise exception 'Protected event identity fields cannot be changed.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.update_invitation_with_identity_check(
  p_invitation_id uuid,
  p_patch jsonb,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invitations%rowtype;
  snapshot jsonb;
  proposed jsonb;
  risk jsonb;
  required_errors jsonb := '{}'::jsonb;
  updated public.invitations%rowtype;
begin
  select *
  into invite
  from public.invitations
  where id = p_invitation_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Invitation not found.' using errcode = 'P0002';
  end if;

  if public.vilique_is_completed_invitation(invite) then
    return jsonb_build_object(
      'locked', true,
      'code', 'INVITATION_COMPLETED_LOCKED',
      'error', 'This invitation is completed and can no longer be edited.'
    );
  end if;

  snapshot := coalesce(invite.event_snapshot, invite.identity_snapshot);

  if invite.first_published_at is not null then
    if btrim(coalesce(p_patch->>'title', invite.title)) = '' then
      required_errors := required_errors || jsonb_build_object('title', 'Enter a title before updating.');
    end if;
    if btrim(coalesce(p_patch->>'primaryName', invite.primary_name)) = '' then
      required_errors := required_errors || jsonb_build_object('primaryName', 'Enter the primary name before updating.');
    end if;
    if btrim(coalesce(p_patch->>'eventDate', invite.event_date::text, '')) = '' then
      required_errors := required_errors || jsonb_build_object('eventDate', 'Choose a valid event date.');
    end if;
    if btrim(coalesce(p_patch->>'eventTime', invite.event_time, '')) = '' then
      required_errors := required_errors || jsonb_build_object('eventTime', 'Choose an event time.');
    end if;
    if btrim(coalesce(p_patch->>'venueName', invite.venue_name, '')) = '' then
      required_errors := required_errors || jsonb_build_object('venueName', 'Enter the venue name before updating.');
    end if;
    if btrim(coalesce(p_patch->>'message', invite.message, '')) = '' then
      required_errors := required_errors || jsonb_build_object('message', 'Enter an invitation message before updating.');
    end if;

    if required_errors <> '{}'::jsonb then
      return jsonb_build_object(
        'validationError', true,
        'code', 'REQUIRED_FIELDS_MISSING',
        'error', 'Complete the required fields before updating.',
        'fields', required_errors
      );
    end if;
  end if;

  if invite.first_published_at is null or snapshot is null then
    perform set_config('app.identity_checked', 'on', true);

    update public.invitations
    set
      slug = case when p_patch ? 'slug' then p_patch->>'slug' else slug end,
      category = case when p_patch ? 'category' then p_patch->>'category' else category end,
      title = case when p_patch ? 'title' then p_patch->>'title' else title end,
      primary_name = case when p_patch ? 'primaryName' then p_patch->>'primaryName' else primary_name end,
      secondary_name = case when p_patch ? 'secondaryName' then nullif(p_patch->>'secondaryName', '') else secondary_name end,
      event_date = case when p_patch ? 'eventDate' then nullif(p_patch->>'eventDate', '')::date else event_date end,
      event_time = case when p_patch ? 'eventTime' then p_patch->>'eventTime' else event_time end,
      venue_name = case when p_patch ? 'venueName' then p_patch->>'venueName' else venue_name end,
      venue_address = case when p_patch ? 'venueAddress' then nullif(p_patch->>'venueAddress', '') else venue_address end,
      map_link = case when p_patch ? 'mapLink' then nullif(p_patch->>'mapLink', '') else map_link end,
      phone = case when p_patch ? 'phone' then nullif(p_patch->>'phone', '') else phone end,
      whatsapp = case when p_patch ? 'whatsapp' then nullif(p_patch->>'whatsapp', '') else whatsapp end,
      message = case when p_patch ? 'message' then p_patch->>'message' else message end,
      music_url = case when p_patch ? 'musicUrl' then nullif(p_patch->>'musicUrl', '') else music_url end,
      cover_image_url = case when p_patch ? 'coverImageUrl' then nullif(p_patch->>'coverImageUrl', '') else cover_image_url end,
      gallery_urls = case when p_patch ? 'galleryUrls' then coalesce(p_patch->'galleryUrls', '[]'::jsonb) else gallery_urls end,
      theme = case when p_patch ? 'theme' then coalesce(p_patch->'theme', '{}'::jsonb) else theme end,
      sections = case when p_patch ? 'sections' then coalesce(p_patch->'sections', '{}'::jsonb) else sections end,
      event_timezone = case when p_patch ? 'eventTimezone' then p_patch->>'eventTimezone' else event_timezone end,
      updated_at = now()
    where id = p_invitation_id
      and user_id = p_user_id
    returning * into updated;

    return jsonb_build_object(
      'id', updated.id,
      'slug', updated.slug,
      'status', updated.status,
      'updated_at', updated.updated_at,
      'riskLevel', null,
      'warning', null
    );
  end if;

  proposed := jsonb_build_object(
    'category', case when p_patch ? 'category' then p_patch->>'category' else invite.category end,
    'primaryName', case when p_patch ? 'primaryName' then p_patch->>'primaryName' else invite.primary_name end,
    'secondaryName', case when p_patch ? 'secondaryName' then nullif(p_patch->>'secondaryName', '') else invite.secondary_name end,
    'eventDate', case when p_patch ? 'eventDate' then nullif(p_patch->>'eventDate', '') else invite.event_date::text end,
    'venueName', case when p_patch ? 'venueName' then p_patch->>'venueName' else invite.venue_name end,
    'venueAddress', case when p_patch ? 'venueAddress' then nullif(p_patch->>'venueAddress', '') else invite.venue_address end,
    'message', case when p_patch ? 'message' then p_patch->>'message' else invite.message end,
    'templateId', invite.template_id
  );

  risk := public.vilique_assess_event_identity_change(snapshot, proposed);

  insert into public.invitation_change_audit (
    invitation_id,
    user_id,
    change_type,
    risk_level,
    previous_values,
    proposed_values,
    decision,
    reason
  ) values (
    p_invitation_id,
    p_user_id,
    'update',
    risk->>'riskLevel',
    jsonb_build_object(
      'category', invite.category,
      'primaryName', invite.primary_name,
      'secondaryName', invite.secondary_name,
      'eventDate', invite.event_date,
      'templateId', invite.template_id
    ),
    proposed,
    risk->>'decision',
    concat(risk->>'reason', case when jsonb_array_length(risk->'signals') > 0 then concat(' Signals: ', risk->>'signals') else '' end)
  );

  insert into public.invitation_change_log (
    invitation_id,
    user_id,
    before,
    after,
    risk,
    score,
    decision,
    reason
  ) values (
    p_invitation_id,
    p_user_id,
    jsonb_build_object(
      'category', invite.category,
      'primaryName', invite.primary_name,
      'secondaryName', invite.secondary_name,
      'eventDate', invite.event_date,
      'venueName', invite.venue_name,
      'venueAddress', invite.venue_address,
      'message', invite.message,
      'templateId', invite.template_id
    ),
    proposed,
    risk->>'riskLevel',
    coalesce((risk->>'score')::integer, 0),
    risk->>'decision',
    concat(risk->>'reason', case when jsonb_array_length(risk->'signals') > 0 then concat(' Signals: ', risk->>'signals') else '' end)
  );

  perform set_config('app.identity_checked', 'on', true);

  update public.invitations
  set
    slug = case when p_patch ? 'slug' then p_patch->>'slug' else slug end,
    category = case when p_patch ? 'category' then p_patch->>'category' else category end,
    title = case when p_patch ? 'title' then p_patch->>'title' else title end,
    primary_name = case when p_patch ? 'primaryName' then p_patch->>'primaryName' else primary_name end,
    secondary_name = case when p_patch ? 'secondaryName' then nullif(p_patch->>'secondaryName', '') else secondary_name end,
    event_date = case when p_patch ? 'eventDate' then nullif(p_patch->>'eventDate', '')::date else event_date end,
    event_time = case when p_patch ? 'eventTime' then p_patch->>'eventTime' else event_time end,
    venue_name = case when p_patch ? 'venueName' then p_patch->>'venueName' else venue_name end,
    venue_address = case when p_patch ? 'venueAddress' then nullif(p_patch->>'venueAddress', '') else venue_address end,
    map_link = case when p_patch ? 'mapLink' then nullif(p_patch->>'mapLink', '') else map_link end,
    phone = case when p_patch ? 'phone' then nullif(p_patch->>'phone', '') else phone end,
    whatsapp = case when p_patch ? 'whatsapp' then nullif(p_patch->>'whatsapp', '') else whatsapp end,
    message = case when p_patch ? 'message' then p_patch->>'message' else message end,
    music_url = case when p_patch ? 'musicUrl' then nullif(p_patch->>'musicUrl', '') else music_url end,
    cover_image_url = case when p_patch ? 'coverImageUrl' then nullif(p_patch->>'coverImageUrl', '') else cover_image_url end,
    gallery_urls = case when p_patch ? 'galleryUrls' then coalesce(p_patch->'galleryUrls', '[]'::jsonb) else gallery_urls end,
    theme = case when p_patch ? 'theme' then coalesce(p_patch->'theme', '{}'::jsonb) else theme end,
    sections = case when p_patch ? 'sections' then coalesce(p_patch->'sections', '{}'::jsonb) else sections end,
    event_timezone = case when p_patch ? 'eventTimezone' then p_patch->>'eventTimezone' else event_timezone end,
    change_risk_status = risk->>'riskLevel',
    event_change_score = coalesce((risk->>'score')::integer, 0),
    updated_at = now()
  where id = p_invitation_id
    and user_id = p_user_id
  returning * into updated;

  return jsonb_build_object(
    'id', updated.id,
    'slug', updated.slug,
    'status', updated.status,
    'updated_at', updated.updated_at,
    'change_risk_status', updated.change_risk_status,
    'event_change_score', updated.event_change_score,
    'riskLevel', risk->>'riskLevel',
    'warning', case when risk->>'decision' = 'warned' then risk->>'reason' else null end
  );
end;
$$;

revoke all on function public.update_invitation_with_identity_check(uuid, jsonb, uuid) from public;
revoke all on function public.update_invitation_with_identity_check(uuid, jsonb, uuid) from authenticated;
grant execute on function public.update_invitation_with_identity_check(uuid, jsonb, uuid) to service_role;

notify pgrst, 'reload schema';
