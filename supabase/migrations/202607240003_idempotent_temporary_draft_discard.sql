-- Atomically discard only a genuinely unfinished temporary invitation draft.
-- Missing or finalized rows are successful no-ops so stale browser recovery
-- markers and duplicate discard requests can be cleared safely.

create or replace function public.discard_temporary_invitation_draft(
  p_invitation_id uuid,
  p_user_id uuid,
  p_editor_session_id uuid,
  p_lock_generation bigint,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invitations%rowtype;
  editor_lock public.invitation_editor_locks%rowtype;
begin
  -- Match the payment finalizer's lock order. If verification, a webhook, or
  -- reconciliation is already publishing this invitation, wait for it and
  -- observe the finalized state instead of racing its update with a delete.
  perform 1
  from public.payments
  where invitation_id = p_invitation_id
    and user_id = p_user_id
  for update;

  select * into invite
  from public.invitations
  where id = p_invitation_id
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', true,
      'disposition', 'already_cleared'
    );
  end if;

  if invite.status <> 'draft'
    or coalesce(invite.lifecycle_status, 'draft') <> 'draft'
    or coalesce(invite.event_status, 'draft') <> 'draft'
    or coalesce(invite.payment_status, 'unpaid') <> 'unpaid'
    or invite.first_published_at is not null
    or invite.published_at is not null
    or exists (
      select 1
      from public.payments payment
      where payment.invitation_id = invite.id
        and payment.user_id = p_user_id
        and (
          payment.status in (
            'paid',
            'captured',
            'authorized',
            'reconciling',
            'publish_pending',
            'published',
            'recovery_pending',
            'manual_review'
          )
          or payment.payment_state = 'captured'
        )
    ) then
    return jsonb_build_object(
      'success', true,
      'disposition', 'finalized'
    );
  end if;

  select * into editor_lock
  from public.invitation_editor_locks
  where invitation_id = p_invitation_id
  for update;

  if not found
    or editor_lock.user_id <> p_user_id
    or editor_lock.editor_session_id <> p_editor_session_id then
    return jsonb_build_object(
      'conflict', true,
      'code', 'LOCK_NOT_OWNED'
    );
  end if;

  if editor_lock.lock_generation <> p_lock_generation then
    return jsonb_build_object(
      'conflict', true,
      'code', 'LOCK_TAKEN_OVER'
    );
  end if;

  if editor_lock.expires_at <= clock_timestamp() then
    return jsonb_build_object(
      'conflict', true,
      'code', 'LOCK_EXPIRED'
    );
  end if;

  if invite.revision <> p_expected_revision then
    return jsonb_build_object(
      'conflict', true,
      'code', 'STALE_REVISION',
      'revision', invite.revision
    );
  end if;

  delete from public.invitations
  where id = p_invitation_id
    and user_id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'disposition', 'deleted'
  );
end;
$$;

revoke all on function public.discard_temporary_invitation_draft(uuid, uuid, uuid, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.discard_temporary_invitation_draft(uuid, uuid, uuid, bigint, bigint)
  to service_role;

notify pgrst, 'reload schema';
