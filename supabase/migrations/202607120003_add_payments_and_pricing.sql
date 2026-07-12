-- Migration: Add template pricing, payments, and webhook events tables with RLS and publishing rules

-- 1. Add pricing columns to invitation_templates
alter table public.invitation_templates
  add column if not exists price_paise integer not null default 0,
  add column if not exists currency text not null default 'INR',
  add column if not exists is_free boolean not null default false;

-- Initialize seeded templates: premium templates cost 4900 paise (₹49) and free templates are free
update public.invitation_templates
set is_free = not is_premium,
    price_paise = case when is_premium then 4900 else 0 end;

-- 2. Add payment_status column to invitations
alter table public.invitations
  add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded'));

-- Mark already published invitations as paid
update public.invitations
set payment_status = 'paid'
where status = 'published';

-- 3. Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  template_id uuid references public.invitation_templates(id) on delete set null,
  provider text not null default 'razorpay',
  provider_order_id text unique,
  provider_payment_id text unique,
  provider_signature text,
  amount_paise integer not null,
  currency text not null default 'INR',
  status text not null check (status in ('created', 'attempted', 'authorized', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  failure_code text,
  failure_description text,
  receipt text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payments indexes
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_invitation_id_idx on public.payments(invitation_id);
create index if not exists payments_provider_order_id_idx on public.payments(provider_order_id);
create index if not exists payments_provider_payment_id_idx on public.payments(provider_payment_id);
create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_created_at_idx on public.payments(created_at);

-- Prevent duplicate successful purchases for the same invitation
create unique index if not exists unique_paid_invitation_idx on public.payments(invitation_id) where (status = 'paid');

-- Trigger to automatically update updated_at for payments
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- 4. Create webhook_events table
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  provider_event_id text unique not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processed', 'failed')),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Webhook events indexes
create index if not exists webhook_events_provider_event_id_idx on public.webhook_events(provider_event_id);

-- Trigger to automatically update updated_at for webhook_events
drop trigger if exists webhook_events_set_updated_at on public.webhook_events;
create trigger webhook_events_set_updated_at
before update on public.webhook_events
for each row execute function public.set_updated_at();

-- 5. Enable Row Level Security (RLS) on both tables
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;

-- 6. Define payment access policy (Users can only select their own records)
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select to authenticated
  using (user_id = auth.uid());

-- Webhook events has no policy for regular users (only service role client can read/write)

-- 7. Define publication verification helper
create or replace function public.can_publish_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_is_free boolean;
  v_has_paid boolean;
begin
  -- Check if invitation template is free
  select coalesce(t.is_free, false) into v_is_free
  from public.invitations i
  join public.invitation_templates t on i.template_id = t.id
  where i.id = p_invitation_id;

  if v_is_free then
    return true;
  end if;

  -- Check if verified paid record exists
  select exists (
    select 1 from public.payments
    where payments.invitation_id = p_invitation_id
      and payments.status = 'paid'
  ) into v_has_paid;

  return v_has_paid;
end;
$$;

-- 8. Harden update policy on invitations to prevent publishing without verified payment or free template
drop policy if exists "invitations_update_own" on public.invitations;
create policy "invitations_update_own" on public.invitations
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    status != 'published'
    or public.can_publish_invitation(id)
  )
);

drop policy if exists "invitations_insert_own" on public.invitations;
create policy "invitations_insert_own" on public.invitations
for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    status != 'published'
    or public.can_publish_invitation(id)
  )
);
