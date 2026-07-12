-- Migration: Expiration lifecycle and single-purchase protection schema

-- 1. Alter invitations table to support lifecycle tracking & abuse snapshotted identity
alter table public.invitations
  add column if not exists lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'published', 'completed', 'archived', 'unpublished')),
  add column if not exists original_category text,
  add column if not exists original_primary_name text,
  add column if not exists original_secondary_name text,
  add column if not exists original_event_date text,
  add column if not exists original_template_id uuid,
  add column if not exists first_published_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists event_timezone text not null default 'Asia/Kolkata',
  add column if not exists change_risk_status text not null default 'low' check (change_risk_status in ('low', 'medium', 'high')),
  add column if not exists identity_snapshot jsonb,
  add column if not exists identity_fingerprint text;

-- Sync existing published status invitations to 'published' lifecycle status
update public.invitations
set lifecycle_status = 'published',
    first_published_at = published_at
where status = 'published' and lifecycle_status = 'draft';

-- 2. Create the change audit table
create table if not exists public.invitation_change_audit (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  change_type text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  previous_values jsonb not null default '{}'::jsonb,
  proposed_values jsonb not null default '{}'::jsonb,
  decision text not null check (decision in ('allowed', 'warned', 'blocked', 'duplicated', 'manually_approved')),
  reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

-- Enable Row Level Security (RLS) on audit table
alter table public.invitation_change_audit enable row level security;

-- Users can select their own audit records
create policy "audit_select_own" on public.invitation_change_audit
  for select to authenticated
  using (user_id = auth.uid());

-- Only system service role or admins can write/update audit logs
create policy "audit_insert_admin" on public.invitation_change_audit
  for insert to authenticated
  with check (public.is_admin());

create policy "audit_update_admin" on public.invitation_change_audit
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "audit_delete_admin" on public.invitation_change_audit
  for delete to authenticated
  using (public.is_admin());

-- 3. Create indexes for quick queries and joins
create index if not exists invitations_lifecycle_status_idx on public.invitations(lifecycle_status);
create index if not exists audit_invitation_id_idx on public.invitation_change_audit(invitation_id);
create index if not exists audit_user_id_idx on public.invitation_change_audit(user_id);
