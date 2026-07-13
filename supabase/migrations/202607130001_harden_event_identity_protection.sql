-- Harden event identity protection at the database boundary.

create or replace function public.vilique_normalize_identity_text(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(value, '')), '\m(mr\.|mrs\.|ms\.|dr\.|mr|mrs|ms|dr|weds|wedding|celebrate|and)\M|&', ' ', 'gi'),
      '[\.,/#!$%\^&\*;:{}=_`~()\+\-]',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  ));
$$;

create or replace function public.vilique_token_similarity(left_value text, right_value text)
returns numeric
language plpgsql
immutable
as $$
declare
  left_tokens text[];
  right_tokens text[];
  intersection_count integer := 0;
  union_count integer := 0;
begin
  select coalesce(array_agg(distinct token), array[]::text[])
  into left_tokens
  from unnest(string_to_array(public.vilique_normalize_identity_text(left_value), ' ')) token
  where length(token) > 2;

  select coalesce(array_agg(distinct token), array[]::text[])
  into right_tokens
  from unnest(string_to_array(public.vilique_normalize_identity_text(right_value), ' ')) token
  where length(token) > 2;

  if cardinality(left_tokens) = 0 and cardinality(right_tokens) = 0 then
    return 1;
  end if;

  if cardinality(left_tokens) = 0 or cardinality(right_tokens) = 0 then
    return 0;
  end if;

  select count(*)
  into intersection_count
  from unnest(left_tokens) token
  where token = any(right_tokens);

  select count(distinct token)
  into union_count
  from (
    select unnest(left_tokens) as token
    union all
    select unnest(right_tokens) as token
  ) tokens;

  if union_count = 0 then
    return 1;
  end if;

  return intersection_count::numeric / union_count::numeric;
end;
$$;

create or replace function public.vilique_date_diff_days(left_value text, right_value text)
returns integer
language plpgsql
immutable
as $$
declare
  left_date date;
  right_date date;
begin
  begin
    left_date := left_value::date;
    right_date := right_value::date;
  exception when others then
    return null;
  end;

  return abs(right_date - left_date);
end;
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
    decision := 'blocked';
    reason := 'This looks like a different event. Your purchase covers one published event. Create a new invitation for this event.';
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

    if checked <> 'on'
       and (
         new.template_id is distinct from old.template_id
         or new.category is distinct from old.category
         or new.primary_name is distinct from old.primary_name
         or new.secondary_name is distinct from old.secondary_name
         or new.event_date is distinct from old.event_date
         or new.venue_name is distinct from old.venue_name
         or new.venue_address is distinct from old.venue_address
         or new.message is distinct from old.message
       ) then
      raise exception 'Published event identity changes must use server validation.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_event_identity_update on public.invitations;
create trigger protect_event_identity_update
before update on public.invitations
for each row execute function public.prevent_event_identity_bypass();

create or replace function public.update_invitation_with_identity_check(
  p_invitation_id uuid,
  p_user_id uuid,
  p_patch jsonb
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

  snapshot := coalesce(invite.event_snapshot, invite.identity_snapshot);

  if invite.first_published_at is not null then
    if btrim(coalesce(p_patch->>'title', invite.title)) = '' then
      required_errors := required_errors || jsonb_build_object('title', 'Enter a title before updating.');
    end if;
    if btrim(coalesce(p_patch->>'primaryName', invite.primary_name)) = '' then
      required_errors := required_errors || jsonb_build_object('primaryName', 'Enter the primary name before updating.');
    end if;
    if btrim(coalesce(p_patch->>'eventDate', invite.event_date, '')) = '' then
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
      slug = coalesce(p_patch->>'slug', slug),
      category = coalesce(p_patch->>'category', category),
      title = coalesce(p_patch->>'title', title),
      primary_name = coalesce(p_patch->>'primaryName', primary_name),
      secondary_name = case when p_patch ? 'secondaryName' then p_patch->>'secondaryName' else secondary_name end,
      event_date = case when p_patch ? 'eventDate' then p_patch->>'eventDate' else event_date end,
      event_time = case when p_patch ? 'eventTime' then p_patch->>'eventTime' else event_time end,
      venue_name = case when p_patch ? 'venueName' then p_patch->>'venueName' else venue_name end,
      venue_address = case when p_patch ? 'venueAddress' then p_patch->>'venueAddress' else venue_address end,
      map_link = case when p_patch ? 'mapLink' then p_patch->>'mapLink' else map_link end,
      phone = case when p_patch ? 'phone' then p_patch->>'phone' else phone end,
      whatsapp = case when p_patch ? 'whatsapp' then p_patch->>'whatsapp' else whatsapp end,
      message = case when p_patch ? 'message' then p_patch->>'message' else message end,
      music_url = case when p_patch ? 'musicUrl' then p_patch->>'musicUrl' else music_url end,
      cover_image_url = case when p_patch ? 'coverImageUrl' then p_patch->>'coverImageUrl' else cover_image_url end,
      gallery_urls = case when p_patch ? 'galleryUrls' then p_patch->'galleryUrls' else gallery_urls end,
      theme = case when p_patch ? 'theme' then p_patch->'theme' else theme end,
      sections = case when p_patch ? 'sections' then p_patch->'sections' else sections end,
      lifecycle_status = case when p_patch ? 'lifecycleStatus' then p_patch->>'lifecycleStatus' else lifecycle_status end,
      event_timezone = coalesce(p_patch->>'eventTimezone', event_timezone),
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
    'category', coalesce(p_patch->>'category', invite.category),
    'primaryName', coalesce(p_patch->>'primaryName', invite.primary_name),
    'secondaryName', case when p_patch ? 'secondaryName' then p_patch->>'secondaryName' else invite.secondary_name end,
    'eventDate', case when p_patch ? 'eventDate' then p_patch->>'eventDate' else invite.event_date end,
    'venueName', case when p_patch ? 'venueName' then p_patch->>'venueName' else invite.venue_name end,
    'venueAddress', case when p_patch ? 'venueAddress' then p_patch->>'venueAddress' else invite.venue_address end,
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

  if risk->>'decision' = 'blocked' then
    return jsonb_build_object(
      'blocked', true,
      'code', 'NEW_EVENT_DETECTED',
      'riskLevel', risk->>'riskLevel',
      'score', coalesce((risk->>'score')::integer, 0),
      'reason', risk->>'reason'
    );
  end if;

  perform set_config('app.identity_checked', 'on', true);

  update public.invitations
  set
    slug = coalesce(p_patch->>'slug', slug),
    category = coalesce(p_patch->>'category', category),
    title = coalesce(p_patch->>'title', title),
    primary_name = coalesce(p_patch->>'primaryName', primary_name),
    secondary_name = case when p_patch ? 'secondaryName' then p_patch->>'secondaryName' else secondary_name end,
    event_date = case when p_patch ? 'eventDate' then p_patch->>'eventDate' else event_date end,
    event_time = case when p_patch ? 'eventTime' then p_patch->>'eventTime' else event_time end,
    venue_name = case when p_patch ? 'venueName' then p_patch->>'venueName' else venue_name end,
    venue_address = case when p_patch ? 'venueAddress' then p_patch->>'venueAddress' else venue_address end,
    map_link = case when p_patch ? 'mapLink' then p_patch->>'mapLink' else map_link end,
    phone = case when p_patch ? 'phone' then p_patch->>'phone' else phone end,
    whatsapp = case when p_patch ? 'whatsapp' then p_patch->>'whatsapp' else whatsapp end,
    message = case when p_patch ? 'message' then p_patch->>'message' else message end,
    music_url = case when p_patch ? 'musicUrl' then p_patch->>'musicUrl' else music_url end,
    cover_image_url = case when p_patch ? 'coverImageUrl' then p_patch->>'coverImageUrl' else cover_image_url end,
    gallery_urls = case when p_patch ? 'galleryUrls' then p_patch->'galleryUrls' else gallery_urls end,
    theme = case when p_patch ? 'theme' then p_patch->'theme' else theme end,
    sections = case when p_patch ? 'sections' then p_patch->'sections' else sections end,
    lifecycle_status = case when p_patch ? 'lifecycleStatus' then p_patch->>'lifecycleStatus' else lifecycle_status end,
    event_timezone = coalesce(p_patch->>'eventTimezone', event_timezone),
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

revoke all on function public.update_invitation_with_identity_check(uuid, uuid, jsonb) from public;
revoke all on function public.update_invitation_with_identity_check(uuid, uuid, jsonb) from authenticated;
grant execute on function public.update_invitation_with_identity_check(uuid, uuid, jsonb) to service_role;
