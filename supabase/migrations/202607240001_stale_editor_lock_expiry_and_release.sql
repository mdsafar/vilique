-- Heartbeat-based stale lock expiration (25s window).

create or replace function public.acquire_invitation_editor_lock(
  p_invitation_id uuid,
  p_user_id uuid,
  p_editor_session_id uuid,
  p_takeover boolean default false,
  p_client_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_lock public.invitation_editor_locks%rowtype;
  next_generation bigint;
  current_revision bigint;
  lease_expires timestamptz := clock_timestamp() + interval '25 seconds';
begin
  select revision into current_revision from public.invitations
   where id = p_invitation_id and user_id = p_user_id
   for update;
  if not found then
    raise exception 'Invitation not found.' using errcode = 'P0002';
  end if;

  select * into current_lock from public.invitation_editor_locks
   where invitation_id = p_invitation_id for update;

  if not found then
    insert into public.invitation_editor_locks (
      invitation_id, user_id, editor_session_id, expires_at, client_metadata
    ) values (
      p_invitation_id, p_user_id, p_editor_session_id, lease_expires,
      coalesce(p_client_metadata, '{}'::jsonb)
    ) returning * into current_lock;
  elsif current_lock.editor_session_id = p_editor_session_id
    and current_lock.user_id = p_user_id
    and (current_lock.expires_at > clock_timestamp() or current_lock.heartbeat_at >= clock_timestamp() - interval '25 seconds') then
    update public.invitation_editor_locks set
      heartbeat_at = clock_timestamp(), expires_at = lease_expires,
      client_metadata = coalesce(p_client_metadata, client_metadata), updated_at = clock_timestamp()
    where invitation_id = p_invitation_id returning * into current_lock;
  elsif current_lock.expires_at <= clock_timestamp() or current_lock.heartbeat_at < clock_timestamp() - interval '25 seconds' or p_takeover then
    next_generation := current_lock.lock_generation + 1;
    update public.invitation_editor_locks set
      user_id = p_user_id, editor_session_id = p_editor_session_id,
      lock_generation = next_generation, acquired_at = clock_timestamp(),
      heartbeat_at = clock_timestamp(), expires_at = lease_expires,
      client_metadata = coalesce(p_client_metadata, '{}'::jsonb), updated_at = clock_timestamp()
    where invitation_id = p_invitation_id returning * into current_lock;
  end if;

  return jsonb_build_object(
    'owned', current_lock.user_id = p_user_id
      and current_lock.editor_session_id = p_editor_session_id
      and current_lock.expires_at > clock_timestamp()
      and current_lock.heartbeat_at >= clock_timestamp() - interval '25 seconds',
    'lockGeneration', current_lock.lock_generation,
    'expiresAt', current_lock.expires_at,
    'heartbeatAt', current_lock.heartbeat_at,
    'revision', current_revision
  );
end;
$$;

create or replace function public.heartbeat_invitation_editor_lock(
  p_invitation_id uuid, p_user_id uuid, p_editor_session_id uuid, p_lock_generation bigint
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare current_lock public.invitation_editor_locks%rowtype;
begin
  select * into current_lock from public.invitation_editor_locks
   where invitation_id = p_invitation_id for update;
  if not found or current_lock.user_id <> p_user_id or current_lock.editor_session_id <> p_editor_session_id
    or current_lock.lock_generation <> p_lock_generation then
    return jsonb_build_object('owned', false, 'code', 'LOCK_TAKEN_OVER');
  end if;
  if current_lock.expires_at <= clock_timestamp() or current_lock.heartbeat_at < clock_timestamp() - interval '25 seconds' then
    return jsonb_build_object('owned', false, 'code', 'LOCK_EXPIRED');
  end if;
  update public.invitation_editor_locks set heartbeat_at = clock_timestamp(),
    expires_at = clock_timestamp() + interval '25 seconds', updated_at = clock_timestamp()
   where invitation_id = p_invitation_id returning * into current_lock;
  return jsonb_build_object('owned', true, 'lockGeneration', current_lock.lock_generation,
    'expiresAt', current_lock.expires_at, 'heartbeatAt', current_lock.heartbeat_at);
end;
$$;

create or replace function public.check_invitation_editor_lock(
  p_invitation_id uuid, p_user_id uuid, p_editor_session_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare current_lock public.invitation_editor_locks%rowtype; current_revision bigint;
begin
  select revision into current_revision from public.invitations
   where id = p_invitation_id and user_id = p_user_id;
  if not found then raise exception 'Invitation not found.' using errcode = 'P0002'; end if;
  select * into current_lock from public.invitation_editor_locks where invitation_id = p_invitation_id;
  if not found then return jsonb_build_object('owned', false, 'available', true, 'revision', current_revision); end if;
  return jsonb_build_object(
    'owned', current_lock.user_id = p_user_id and current_lock.editor_session_id = p_editor_session_id
      and current_lock.expires_at > clock_timestamp() and current_lock.heartbeat_at >= clock_timestamp() - interval '25 seconds',
    'available', current_lock.expires_at <= clock_timestamp() or current_lock.heartbeat_at < clock_timestamp() - interval '25 seconds',
    'lockGeneration', current_lock.lock_generation, 'expiresAt', current_lock.expires_at,
    'heartbeatAt', current_lock.heartbeat_at, 'revision', current_revision
  );
end;
$$;
