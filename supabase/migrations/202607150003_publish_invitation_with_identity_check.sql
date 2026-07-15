create or replace function public.publish_invitation_with_identity_check(
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
  updated public.invitations%rowtype;
begin
  perform set_config('app.identity_checked', 'on', true);

  update public.invitations
  set
    slug = coalesce(p_patch->>'slug', slug),
    status = coalesce(p_patch->>'status', status),
    lifecycle_status = coalesce(p_patch->>'lifecycle_status', lifecycle_status),
    event_status = coalesce(p_patch->>'event_status', event_status),
    published_at = coalesce(nullif(p_patch->>'published_at', '')::timestamptz, published_at),
    first_published_at = coalesce(nullif(p_patch->>'first_published_at', '')::timestamptz, first_published_at),
    first_payment_id = coalesce(nullif(p_patch->>'first_payment_id', '')::uuid, first_payment_id),
    publish_version = coalesce((p_patch->>'publish_version')::integer, publish_version),
    first_publish_version = coalesce((p_patch->>'first_publish_version')::integer, first_publish_version),
    payment_status = coalesce(p_patch->>'payment_status', payment_status),
    original_category = case when p_patch ? 'original_category' then p_patch->>'original_category' else original_category end,
    original_primary_name = case when p_patch ? 'original_primary_name' then p_patch->>'original_primary_name' else original_primary_name end,
    original_secondary_name = case when p_patch ? 'original_secondary_name' then nullif(p_patch->>'original_secondary_name', '') else original_secondary_name end,
    original_event_date = case when p_patch ? 'original_event_date' then nullif(p_patch->>'original_event_date', '')::date else original_event_date end,
    original_template_id = case when p_patch ? 'original_template_id' then nullif(p_patch->>'original_template_id', '')::uuid else original_template_id end,
    event_snapshot = case when p_patch ? 'event_snapshot' then p_patch->'event_snapshot' else event_snapshot end,
    identity_snapshot = case when p_patch ? 'identity_snapshot' then p_patch->'identity_snapshot' else identity_snapshot end,
    identity_fingerprint = case when p_patch ? 'identity_fingerprint' then p_patch->>'identity_fingerprint' else identity_fingerprint end,
    event_change_score = coalesce((p_patch->>'event_change_score')::integer, event_change_score),
    change_risk_status = coalesce(p_patch->>'change_risk_status', change_risk_status),
    updated_at = coalesce(nullif(p_patch->>'updated_at', '')::timestamptz, now())
  where id = p_invitation_id
    and user_id = p_user_id
  returning * into updated;

  if updated.id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', updated.id,
    'slug', updated.slug,
    'status', updated.status,
    'published_at', updated.published_at
  );
end;
$$;

revoke all on function public.publish_invitation_with_identity_check(uuid, uuid, jsonb) from public;
revoke all on function public.publish_invitation_with_identity_check(uuid, uuid, jsonb) from authenticated;
grant execute on function public.publish_invitation_with_identity_check(uuid, uuid, jsonb) to service_role;
