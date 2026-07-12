-- One purchase = one event entitlement hardening.

alter table public.invitations
  add column if not exists event_snapshot jsonb,
  add column if not exists event_change_score integer not null default 0,
  add column if not exists event_status text not null default 'draft' check (event_status in ('draft', 'published', 'completed', 'archived', 'unpublished')),
  add column if not exists first_payment_id uuid references public.payments(id) on delete set null,
  add column if not exists publish_version integer not null default 0,
  add column if not exists first_publish_version integer;

update public.invitations
set event_status = lifecycle_status
where event_status = 'draft'
  and lifecycle_status in ('published', 'completed', 'archived', 'unpublished');

update public.invitations
set event_snapshot = identity_snapshot
where event_snapshot is null
  and identity_snapshot is not null;

update public.invitations
set publish_version = 1,
    first_publish_version = 1
where first_published_at is not null
  and publish_version = 0;

update public.invitations i
set first_payment_id = p.id
from public.payments p
where i.first_payment_id is null
  and p.invitation_id = i.id
  and p.user_id = i.user_id
  and p.status = 'paid';

create index if not exists invitations_event_status_idx on public.invitations(event_status);
create index if not exists invitations_first_payment_id_idx on public.invitations(first_payment_id);

create table if not exists public.invitation_change_log (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  risk text not null check (risk in ('low', 'medium', 'high')),
  score integer not null default 0,
  decision text not null check (decision in ('allowed', 'warned', 'blocked', 'duplicated', 'manually_approved')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.invitation_change_log enable row level security;

drop policy if exists "change_log_select_own" on public.invitation_change_log;
create policy "change_log_select_own" on public.invitation_change_log
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "change_log_insert_admin" on public.invitation_change_log;
create policy "change_log_insert_admin" on public.invitation_change_log
  for insert to authenticated
  with check (public.is_admin());

create index if not exists change_log_invitation_id_idx on public.invitation_change_log(invitation_id);
create index if not exists change_log_user_id_idx on public.invitation_change_log(user_id);
