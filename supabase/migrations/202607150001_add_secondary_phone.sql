alter table public.invitations
  add column if not exists secondary_phone text;

update public.invitations
set secondary_phone = '9000000001'
where nullif(secondary_phone, '') is null
  and not public.vilique_is_completed_invitation(invitations);

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
    if btrim(coalesce(p_patch->>'phone', invite.phone, '')) = '' then
      required_errors := required_errors || jsonb_build_object('phone', 'Enter the primary phone number before updating.');
    elsif length(coalesce(p_patch->>'phone', invite.phone)) <> 10 then
      required_errors := required_errors || jsonb_build_object('phone', 'Primary phone number must be 10 digits.');
    end if;
    if btrim(coalesce(p_patch->>'secondaryPhone', invite.secondary_phone, '')) = '' then
      required_errors := required_errors || jsonb_build_object('secondaryPhone', 'Enter the secondary phone number before updating.');
    elsif length(coalesce(p_patch->>'secondaryPhone', invite.secondary_phone)) <> 10 then
      required_errors := required_errors || jsonb_build_object('secondaryPhone', 'Secondary phone number must be 10 digits.');
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
      secondary_phone = case when p_patch ? 'secondaryPhone' then nullif(p_patch->>'secondaryPhone', '') else secondary_phone end,
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
    secondary_phone = case when p_patch ? 'secondaryPhone' then nullif(p_patch->>'secondaryPhone', '') else secondary_phone end,
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
