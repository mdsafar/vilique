-- Public RSVP persistence, one active response per guest token, and realtime support.

alter table public.rsvps
  add column if not exists guest_token text,
  add column if not exists updated_at timestamptz not null default now();

update public.rsvps
set guest_token = 'legacy:' || id::text
where guest_token is null;

alter table public.rsvps
  alter column guest_token set not null;

create unique index if not exists rsvps_invitation_guest_token_key
  on public.rsvps(invitation_id, guest_token);

drop trigger if exists rsvps_set_updated_at on public.rsvps;
create trigger rsvps_set_updated_at
before update on public.rsvps
for each row execute function public.set_updated_at();

drop policy if exists "rsvps_public_insert_published" on public.rsvps;
drop policy if exists "rsvps_public_update_published" on public.rsvps;
drop policy if exists "rsvps_public_select_own_token" on public.rsvps;

create or replace function public.get_public_rsvp(
  p_invitation_id uuid,
  p_guest_token text
)
returns table (
  id uuid,
  status text,
  guest_name text,
  guest_phone text,
  guest_count integer,
  message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_guest_token is null or length(trim(p_guest_token)) < 16 then
    return;
  end if;

  if not exists (
    select 1
    from public.invitations i
    where i.id = p_invitation_id
      and i.status = 'published'
  ) then
    return;
  end if;

  return query
  select r.id, r.status, r.guest_name, r.guest_phone, r.guest_count, r.message, r.created_at, r.updated_at
  from public.rsvps r
  where r.invitation_id = p_invitation_id
    and r.guest_token = trim(p_guest_token)
  limit 1;
end;
$$;

create or replace function public.upsert_public_rsvp(
  p_invitation_id uuid,
  p_guest_token text,
  p_status text,
  p_guest_name text default 'Guest',
  p_guest_phone text default null,
  p_guest_count integer default 1,
  p_message text default null
)
returns table (
  id uuid,
  status text,
  guest_name text,
  guest_phone text,
  guest_count integer,
  message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invitations%rowtype;
  safe_guest_name text;
  safe_guest_count integer;
begin
  if p_guest_token is null or length(trim(p_guest_token)) < 16 then
    raise exception 'Missing guest identity.' using errcode = '22023';
  end if;

  if p_status not in ('accepted', 'declined', 'maybe') then
    raise exception 'Invalid RSVP status.' using errcode = '22023';
  end if;

  select *
  into invite
  from public.invitations
  where invitations.id = p_invitation_id
  limit 1;

  if invite.id is null or invite.status <> 'published' then
    raise exception 'RSVP is only available for published invitations.' using errcode = '42501';
  end if;

  if public.vilique_is_completed_invitation(invite) then
    raise exception 'This event has already concluded.' using errcode = '22023';
  end if;

  safe_guest_name := left(coalesce(nullif(trim(p_guest_name), ''), 'Guest'), 100);
  safe_guest_count := greatest(1, least(coalesce(p_guest_count, 1), 10));

  insert into public.rsvps (
    invitation_id,
    guest_token,
    guest_name,
    guest_phone,
    status,
    guest_count,
    message
  )
  values (
    p_invitation_id,
    trim(p_guest_token),
    safe_guest_name,
    nullif(left(coalesce(p_guest_phone, ''), 32), ''),
    p_status,
    safe_guest_count,
    nullif(left(coalesce(p_message, ''), 400), '')
  )
  on conflict (invitation_id, guest_token)
  do update set
    guest_name = excluded.guest_name,
    guest_phone = excluded.guest_phone,
    status = excluded.status,
    guest_count = excluded.guest_count,
    message = excluded.message
  returning rsvps.id, rsvps.status, rsvps.guest_name, rsvps.guest_phone, rsvps.guest_count, rsvps.message, rsvps.created_at, rsvps.updated_at
  into id, status, guest_name, guest_phone, guest_count, message, created_at, updated_at;

  insert into public.invitation_events (invitation_id, event_type, metadata)
  values (
    p_invitation_id,
    'rsvp_submit',
    jsonb_build_object('status', p_status, 'guestToken', trim(p_guest_token), 'source', 'public_rsvp')
  );

  return next;
end;
$$;

revoke all on function public.get_public_rsvp(uuid, text) from public;
revoke all on function public.upsert_public_rsvp(uuid, text, text, text, text, integer, text) from public;
grant execute on function public.get_public_rsvp(uuid, text) to anon, authenticated;
grant execute on function public.upsert_public_rsvp(uuid, text, text, text, text, integer, text) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rsvps;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.invitation_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.guest_wishes;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
