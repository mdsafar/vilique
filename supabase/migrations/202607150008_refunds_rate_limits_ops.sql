-- Refund initiation/reconciliation and distributed rate-limit primitives.

alter table public.payments
  add column if not exists refund_amount_paise integer,
  add column if not exists refund_approved_by uuid,
  add column if not exists refund_approved_at timestamptz,
  add column if not exists refund_initiated_by text,
  add column if not exists refund_attempt_count integer not null default 0,
  add column if not exists last_refund_reconciliation_at timestamptz,
  add column if not exists next_refund_reconciliation_at timestamptz;

create table if not exists public.payment_refund_requests (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete set null,
  provider_payment_id text not null,
  provider_refund_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null,
  status text not null default 'processing' check (status in ('processing', 'pending', 'processed', 'failed', 'manual_review')),
  requested_by uuid,
  requested_source text not null default 'admin' check (requested_source in ('admin', 'system', 'cron')),
  public_reason text not null,
  provider_payload jsonb not null default '{}'::jsonb,
  last_error text,
  attempt_count integer not null default 1,
  requested_at timestamptz not null default now(),
  provider_created_at timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.payment_refund_requests enable row level security;

drop trigger if exists payment_refund_requests_set_updated_at on public.payment_refund_requests;
create trigger payment_refund_requests_set_updated_at
before update on public.payment_refund_requests
for each row execute function public.set_updated_at();

create unique index if not exists payment_refund_requests_payment_key
  on public.payment_refund_requests(payment_id);

create unique index if not exists payment_refund_requests_provider_refund_key
  on public.payment_refund_requests(provider_refund_id)
  where provider_refund_id is not null;

create index if not exists payment_refund_requests_status_next_idx
  on public.payment_refund_requests(status, updated_at);

drop policy if exists "payment_refund_requests_admin_select" on public.payment_refund_requests;
create policy "payment_refund_requests_admin_select" on public.payment_refund_requests
  for select to authenticated
  using (public.is_admin());

create table if not exists public.request_rate_limits (
  bucket_key text primary key,
  hit_count integer not null default 0,
  reset_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.request_rate_limits enable row level security;

create index if not exists request_rate_limits_reset_idx on public.request_rate_limits(reset_at);

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  hit_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.request_rate_limits%rowtype;
begin
  if p_bucket_key is null or length(p_bucket_key) < 8 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit input' using errcode = '22023';
  end if;

  insert into public.request_rate_limits(bucket_key, hit_count, reset_at, first_seen_at, updated_at)
  values (p_bucket_key, 1, v_now + make_interval(secs => p_window_seconds), v_now, v_now)
  on conflict (bucket_key) do update
    set hit_count = case
          when public.request_rate_limits.reset_at <= v_now then 1
          else public.request_rate_limits.hit_count + 1
        end,
        reset_at = case
          when public.request_rate_limits.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds)
          else public.request_rate_limits.reset_at
        end,
        first_seen_at = case
          when public.request_rate_limits.reset_at <= v_now then v_now
          else public.request_rate_limits.first_seen_at
        end,
        updated_at = v_now
  returning * into v_row;

  return query select
    v_row.hit_count <= p_limit,
    greatest(p_limit - v_row.hit_count, 0),
    v_row.reset_at,
    v_row.hit_count;
end;
$$;

create or replace function public.claim_unrecoverable_publish_refund(
  p_payment_id uuid,
  p_requested_by uuid,
  p_requested_source text,
  p_public_reason text,
  p_manual_approval boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_invitation public.invitations%rowtype;
  v_existing public.payment_refund_requests%rowtype;
  v_now timestamptz := now();
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  select * into v_invitation
  from public.invitations
  where id = v_payment.invitation_id
  for update;

  select * into v_existing
  from public.payment_refund_requests
  where payment_id = v_payment.id
  for update;

  if v_existing.id is not null then
    return jsonb_build_object(
      'status', v_existing.status,
      'claimed', false,
      'payment_id', v_payment.id,
      'refund_request_id', v_existing.id,
      'provider_refund_id', v_existing.provider_refund_id,
      'amount_paise', v_existing.amount_paise,
      'currency', v_existing.currency
    );
  end if;

  if v_payment.provider_payment_id is null
    or v_payment.payment_state <> 'captured'
    or v_payment.status not in ('captured', 'recovery_pending', 'manual_review')
    or v_payment.publish_state = 'published'
    or v_payment.refund_state in ('pending', 'processed')
    or v_payment.provider_refund_id is not null
    or coalesce(v_invitation.status, '') = 'published'
    or v_invitation.published_at is not null
    or v_invitation.first_published_at is not null
    or (v_payment.recovery_state <> 'unrecoverable' and coalesce(p_manual_approval, false) is not true) then
    raise exception 'Refund eligibility failed' using errcode = '22000';
  end if;

  insert into public.payment_refund_requests (
    payment_id,
    invitation_id,
    provider_payment_id,
    amount_paise,
    currency,
    status,
    requested_by,
    requested_source,
    public_reason,
    requested_at
  ) values (
    v_payment.id,
    v_payment.invitation_id,
    v_payment.provider_payment_id,
    v_payment.amount_paise,
    v_payment.currency,
    'processing',
    p_requested_by,
    coalesce(nullif(p_requested_source, ''), 'admin'),
    coalesce(nullif(p_public_reason, ''), 'Refund issued because the paid invitation could not be published after recovery attempts.'),
    v_now
  )
  returning * into v_existing;

  update public.payments
  set status = 'refund_pending',
      refund_state = 'pending',
      refund_amount_paise = amount_paise,
      refund_requested_at = v_now,
      refund_approved_by = p_requested_by,
      refund_approved_at = v_now,
      refund_initiated_by = coalesce(nullif(p_requested_source, ''), 'admin'),
      refund_reason_public = coalesce(nullif(p_public_reason, ''), 'Refund issued because the paid invitation could not be published after recovery attempts.'),
      refund_attempt_count = refund_attempt_count + 1,
      next_refund_reconciliation_at = v_now + interval '15 minutes',
      updated_at = v_now
  where id = v_payment.id;

  insert into public.payment_audit_log (
    payment_id,
    invitation_id,
    actor_id,
    actor_type,
    action,
    previous_state,
    resulting_state,
    reason,
    correlation_id
  ) values (
    v_payment.id,
    v_payment.invitation_id,
    p_requested_by,
    case when p_requested_source = 'cron' then 'cron' when p_requested_source = 'system' then 'system' else 'admin' end,
    'refund_initiation_claimed',
    jsonb_build_object('status', v_payment.status, 'refund_state', v_payment.refund_state, 'recovery_state', v_payment.recovery_state),
    jsonb_build_object('status', 'refund_pending', 'refund_state', 'pending'),
    p_public_reason,
    v_existing.id::text
  );

  return jsonb_build_object(
    'status', 'processing',
    'claimed', true,
    'payment_id', v_payment.id,
    'refund_request_id', v_existing.id,
    'provider_payment_id', v_payment.provider_payment_id,
    'amount_paise', v_payment.amount_paise,
    'currency', v_payment.currency
  );
end;
$$;

create or replace function public.mark_refund_provider_created(
  p_refund_request_id uuid,
  p_provider_refund_id text,
  p_provider_payload jsonb,
  p_provider_status text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.payment_refund_requests%rowtype;
  v_status text := lower(coalesce(p_provider_status, 'pending'));
  v_now timestamptz := now();
begin
  select * into v_request
  from public.payment_refund_requests
  where id = p_refund_request_id
  for update;

  if v_request.id is null then
    raise exception 'Refund request not found' using errcode = 'P0002';
  end if;

  update public.payment_refund_requests
  set provider_refund_id = p_provider_refund_id,
      provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
      status = case when v_status in ('processed', 'refunded') then 'processed' else 'pending' end,
      provider_created_at = coalesce(provider_created_at, v_now),
      processed_at = case when v_status in ('processed', 'refunded') then coalesce(processed_at, v_now) else processed_at end,
      last_error = null
  where id = v_request.id
  returning * into v_request;

  update public.payments
  set provider_refund_id = p_provider_refund_id,
      status = case when v_request.status = 'processed' then 'refunded' else 'refund_pending' end,
      payment_state = case when v_request.status = 'processed' then 'refunded' else payment_state end,
      refund_state = case when v_request.status = 'processed' then 'processed' else 'pending' end,
      refund_processed_at = case when v_request.status = 'processed' then coalesce(refund_processed_at, v_now) else refund_processed_at end,
      refunded_at = case when v_request.status = 'processed' then coalesce(refunded_at, v_now) else refunded_at end,
      next_refund_reconciliation_at = case when v_request.status = 'processed' then null else v_now + interval '15 minutes' end,
      last_error = null,
      updated_at = v_now
  where id = v_request.payment_id;

  return jsonb_build_object('status', v_request.status, 'provider_refund_id', p_provider_refund_id);
end;
$$;

create or replace function public.mark_refund_provider_failed(
  p_refund_request_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.payment_refund_requests%rowtype;
  v_now timestamptz := now();
begin
  select * into v_request
  from public.payment_refund_requests
  where id = p_refund_request_id
  for update;

  if v_request.id is null then
    raise exception 'Refund request not found' using errcode = 'P0002';
  end if;

  update public.payment_refund_requests
  set status = 'failed',
      failed_at = v_now,
      last_error = left(coalesce(p_error, 'Refund provider call failed'), 1000)
  where id = v_request.id;

  update public.payments
  set status = 'manual_review',
      refund_state = 'failed',
      recovery_state = 'manual_review',
      last_error = left(coalesce(p_error, 'Refund provider call failed'), 1000),
      updated_at = v_now
  where id = v_request.payment_id;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to anon, authenticated, service_role;

revoke all on function public.claim_unrecoverable_publish_refund(uuid, uuid, text, text, boolean) from public;
revoke all on function public.claim_unrecoverable_publish_refund(uuid, uuid, text, text, boolean) from authenticated;
grant execute on function public.claim_unrecoverable_publish_refund(uuid, uuid, text, text, boolean) to service_role;

revoke all on function public.mark_refund_provider_created(uuid, text, jsonb, text) from public;
revoke all on function public.mark_refund_provider_created(uuid, text, jsonb, text) from authenticated;
grant execute on function public.mark_refund_provider_created(uuid, text, jsonb, text) to service_role;

revoke all on function public.mark_refund_provider_failed(uuid, text) from public;
revoke all on function public.mark_refund_provider_failed(uuid, text) from authenticated;
grant execute on function public.mark_refund_provider_failed(uuid, text) to service_role;
