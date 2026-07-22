-- Single-active-editor leases and optimistic invitation revisions.
-- Rollback: drop the RPC overloads/table below, then drop invitations.revision.

alter table public.invitations
  add column if not exists revision bigint not null default 0;

create table if not exists public.invitation_editor_locks (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  editor_session_id uuid not null,
  lock_generation bigint not null default 1 check (lock_generation > 0),
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  client_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invitation_editor_locks_expiry_idx
  on public.invitation_editor_locks(expires_at);
create index if not exists invitation_editor_locks_heartbeat_idx
  on public.invitation_editor_locks(heartbeat_at);
create index if not exists invitation_editor_locks_owner_session_idx
  on public.invitation_editor_locks(user_id, editor_session_id);

alter table public.invitation_editor_locks enable row level security;
revoke all on table public.invitation_editor_locks from public, anon, authenticated;

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
  lease_expires timestamptz := clock_timestamp() + interval '55 seconds';
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
    and current_lock.expires_at > clock_timestamp() then
    update public.invitation_editor_locks set
      heartbeat_at = clock_timestamp(), expires_at = lease_expires,
      client_metadata = coalesce(p_client_metadata, client_metadata), updated_at = clock_timestamp()
    where invitation_id = p_invitation_id returning * into current_lock;
  elsif current_lock.expires_at <= clock_timestamp() or p_takeover then
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
      and current_lock.expires_at > clock_timestamp(),
    'lockGeneration', current_lock.lock_generation,
    'expiresAt', current_lock.expires_at,
    'heartbeatAt', current_lock.heartbeat_at
    , 'revision', current_revision
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
  if current_lock.expires_at <= clock_timestamp() then
    return jsonb_build_object('owned', false, 'code', 'LOCK_EXPIRED');
  end if;
  update public.invitation_editor_locks set heartbeat_at = clock_timestamp(),
    expires_at = clock_timestamp() + interval '55 seconds', updated_at = clock_timestamp()
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
      and current_lock.expires_at > clock_timestamp(),
    'available', current_lock.expires_at <= clock_timestamp(),
    'lockGeneration', current_lock.lock_generation, 'expiresAt', current_lock.expires_at,
    'heartbeatAt', current_lock.heartbeat_at, 'revision', current_revision
  );
end;
$$;

create or replace function public.release_invitation_editor_lock(
  p_invitation_id uuid, p_user_id uuid, p_editor_session_id uuid, p_lock_generation bigint
)
returns boolean language sql security definer set search_path = public as $$
  delete from public.invitation_editor_locks
   where invitation_id = p_invitation_id and user_id = p_user_id
     and editor_session_id = p_editor_session_id and lock_generation = p_lock_generation
  returning true;
$$;

create or replace function public.update_invitation_with_editor_lock(
  p_invitation_id uuid, p_patch jsonb, p_user_id uuid, p_editor_session_id uuid,
  p_lock_generation bigint, p_expected_revision bigint
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare invite public.invitations%rowtype; editor_lock public.invitation_editor_locks%rowtype; result jsonb; next_revision bigint;
begin
  select * into invite from public.invitations
   where id = p_invitation_id and user_id = p_user_id for update;
  if not found then raise exception 'Invitation not found.' using errcode = 'P0002'; end if;
  select * into editor_lock from public.invitation_editor_locks
   where invitation_id = p_invitation_id for update;
  if not found or editor_lock.user_id <> p_user_id or editor_lock.editor_session_id <> p_editor_session_id then
    return jsonb_build_object('conflict', true, 'code', 'LOCK_NOT_OWNED', 'revision', invite.revision);
  end if;
  if editor_lock.lock_generation <> p_lock_generation then
    return jsonb_build_object('conflict', true, 'code', 'LOCK_TAKEN_OVER', 'revision', invite.revision);
  end if;
  if editor_lock.expires_at <= clock_timestamp() then
    return jsonb_build_object('conflict', true, 'code', 'LOCK_EXPIRED', 'revision', invite.revision);
  end if;
  if invite.revision <> p_expected_revision then
    return jsonb_build_object('conflict', true, 'code', 'STALE_REVISION', 'revision', invite.revision);
  end if;
  result := public.update_invitation_with_identity_check(p_invitation_id, p_patch, p_user_id);
  if coalesce((result->>'blocked')::boolean, false) or coalesce((result->>'locked')::boolean, false)
    or coalesce((result->>'validationError')::boolean, false) then return result; end if;
  update public.invitations set revision = revision + 1 where id = p_invitation_id returning revision into next_revision;
  return result || jsonb_build_object('revision', next_revision);
end;
$$;

create or replace function public.publish_invitation_with_editor_lock(
  p_invitation_id uuid, p_user_id uuid, p_patch jsonb, p_editor_session_id uuid,
  p_lock_generation bigint, p_expected_revision bigint
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare invite public.invitations%rowtype; editor_lock public.invitation_editor_locks%rowtype; result jsonb; next_revision bigint;
begin
  select * into invite from public.invitations where id = p_invitation_id and user_id = p_user_id for update;
  if not found then raise exception 'Invitation not found' using errcode = 'P0002'; end if;
  select * into editor_lock from public.invitation_editor_locks where invitation_id = p_invitation_id for update;
  if not found or editor_lock.user_id <> p_user_id or editor_lock.editor_session_id <> p_editor_session_id then
    raise exception 'LOCK_NOT_OWNED' using errcode = 'P0001';
  end if;
  if editor_lock.lock_generation <> p_lock_generation then raise exception 'LOCK_TAKEN_OVER' using errcode = 'P0001'; end if;
  if editor_lock.expires_at <= clock_timestamp() then raise exception 'LOCK_EXPIRED' using errcode = 'P0001'; end if;
  if invite.revision <> p_expected_revision then raise exception 'STALE_REVISION' using errcode = 'P0001'; end if;
  result := public.publish_invitation_with_identity_check(p_invitation_id, p_user_id, p_patch);
  update public.invitations set revision = revision + 1 where id = p_invitation_id returning revision into next_revision;
  delete from public.invitation_editor_locks where invitation_id = p_invitation_id;
  return result || jsonb_build_object('revision', next_revision);
end;
$$;

revoke all on function public.acquire_invitation_editor_lock(uuid, uuid, uuid, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.heartbeat_invitation_editor_lock(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.check_invitation_editor_lock(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_invitation_editor_lock(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.update_invitation_with_editor_lock(uuid, jsonb, uuid, uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.publish_invitation_with_editor_lock(uuid, uuid, jsonb, uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.acquire_invitation_editor_lock(uuid, uuid, uuid, boolean, jsonb) to service_role;
grant execute on function public.heartbeat_invitation_editor_lock(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.check_invitation_editor_lock(uuid, uuid, uuid) to service_role;
grant execute on function public.release_invitation_editor_lock(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.update_invitation_with_editor_lock(uuid, jsonb, uuid, uuid, bigint, bigint) to service_role;
grant execute on function public.publish_invitation_with_editor_lock(uuid, uuid, jsonb, uuid, bigint, bigint) to service_role;

notify pgrst, 'reload schema';
