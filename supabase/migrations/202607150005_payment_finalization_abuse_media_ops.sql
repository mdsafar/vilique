-- Production hardening: payment finalization, recovery, abuse controls, media privacy, and indexes.

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check check (
    status in (
      'created',
      'pending',
      'attempted',
      'authorized',
      'captured',
      'reconciling',
      'publish_pending',
      'published',
      'recovery_pending',
      'refund_pending',
      'refunded',
      'partially_refunded',
      'failed',
      'cancelled',
      'manual_review',
      'paid'
    )
  );

alter table public.payments
  add column if not exists payment_state text not null default 'created',
  add column if not exists publish_state text not null default 'draft',
  add column if not exists recovery_state text not null default 'none',
  add column if not exists refund_state text not null default 'none',
  add column if not exists provider_status text,
  add column if not exists provider_captured_at timestamptz,
  add column if not exists reconciled_at timestamptz,
  add column if not exists publish_attempt_count integer not null default 0,
  add column if not exists last_publish_attempt_at timestamptz,
  add column if not exists last_reconciliation_at timestamptz,
  add column if not exists next_reconciliation_at timestamptz,
  add column if not exists last_error text,
  add column if not exists provider_refund_id text,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_processed_at timestamptz,
  add column if not exists unrecoverable_at timestamptz,
  add column if not exists manual_review_reason text;

alter table public.payments
  drop constraint if exists payments_payment_state_check,
  add constraint payments_payment_state_check check (payment_state in ('created', 'pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded'));

alter table public.payments
  drop constraint if exists payments_publish_state_check,
  add constraint payments_publish_state_check check (publish_state in ('draft', 'publish_pending', 'published', 'failed'));

alter table public.payments
  drop constraint if exists payments_recovery_state_check,
  add constraint payments_recovery_state_check check (recovery_state in ('none', 'pending', 'retrying', 'manual_review', 'unrecoverable', 'recovered'));

alter table public.payments
  drop constraint if exists payments_refund_state_check,
  add constraint payments_refund_state_check check (refund_state in ('none', 'eligible', 'pending', 'processed', 'failed'));

update public.payments
set
  payment_state = case
    when status in ('paid', 'captured', 'published', 'refund_pending', 'refunded', 'partially_refunded') then 'captured'
    when status = 'authorized' then 'authorized'
    when status in ('failed', 'cancelled') then status
    else 'created'
  end,
  publish_state = case
    when status in ('published', 'paid') then 'published'
    when status in ('publish_pending', 'recovery_pending', 'manual_review') then 'publish_pending'
    else publish_state
  end,
  recovery_state = case
    when status in ('recovery_pending') then 'pending'
    when status in ('manual_review') then 'manual_review'
    else recovery_state
  end,
  refund_state = case
    when status in ('refund_pending') then 'pending'
    when status in ('refunded', 'partially_refunded') then 'processed'
    else refund_state
  end;

drop index if exists unique_paid_invitation_idx;
create unique index if not exists unique_successful_publish_payment_idx
  on public.payments(invitation_id)
  where status in ('paid', 'published');

create unique index if not exists payments_provider_payment_id_not_null_key
  on public.payments(provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists payments_provider_refund_id_not_null_key
  on public.payments(provider_refund_id)
  where provider_refund_id is not null;

create index if not exists payments_user_created_id_idx on public.payments(user_id, created_at desc, id);
create index if not exists payments_invitation_created_id_idx on public.payments(invitation_id, created_at desc, id);
create index if not exists payments_reconciliation_candidates_idx
  on public.payments(status, next_reconciliation_at, updated_at)
  where status in ('captured', 'publish_pending', 'recovery_pending', 'refund_pending', 'manual_review');
create index if not exists payments_state_idx on public.payments(payment_state, publish_state, recovery_state, refund_state);

alter table public.invitations
  drop constraint if exists invitations_payment_status_check;

alter table public.invitations
  add constraint invitations_payment_status_check check (
    payment_status in ('unpaid', 'paid', 'publish_pending', 'recovery_pending', 'refund_pending', 'refunded')
  );

create table if not exists public.payment_audit_log (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  invitation_id uuid references public.invitations(id) on delete set null,
  actor_id uuid,
  actor_type text not null default 'system' check (actor_type in ('system', 'user', 'webhook', 'cron', 'admin')),
  action text not null,
  previous_state jsonb not null default '{}'::jsonb,
  resulting_state jsonb not null default '{}'::jsonb,
  reason text,
  correlation_id text,
  created_at timestamptz not null default now()
);

alter table public.payment_audit_log enable row level security;

drop policy if exists "payment_audit_log_admin_select" on public.payment_audit_log;
create policy "payment_audit_log_admin_select" on public.payment_audit_log
  for select to authenticated
  using (public.is_admin());

create index if not exists payment_audit_log_payment_created_idx on public.payment_audit_log(payment_id, created_at desc);
create index if not exists payment_audit_log_invitation_created_idx on public.payment_audit_log(invitation_id, created_at desc);

create table if not exists public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  terms_version text not null,
  refund_policy_version text not null,
  accepted_at timestamptz not null default now()
);

alter table public.policy_acceptances enable row level security;

drop policy if exists "policy_acceptances_select_own" on public.policy_acceptances;
create policy "policy_acceptances_select_own" on public.policy_acceptances
  for select to authenticated
  using (user_id = auth.uid());

create unique index if not exists policy_acceptance_payment_key
  on public.policy_acceptances(payment_id)
  where payment_id is not null;

create table if not exists public.public_submission_guard (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('event', 'rsvp', 'wish')),
  invitation_id uuid references public.invitations(id) on delete cascade,
  dedupe_key text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  hit_count integer not null default 1
);

alter table public.public_submission_guard enable row level security;

create unique index if not exists public_submission_guard_scope_key
  on public.public_submission_guard(scope, invitation_id, dedupe_key, action);

create index if not exists public_submission_guard_seen_idx on public.public_submission_guard(scope, last_seen_at desc);

alter table public.invitation_events
  add column if not exists dedupe_key text,
  add column if not exists visitor_token_hash text,
  add column if not exists time_bucket timestamptz;

create unique index if not exists invitation_events_dedupe_key_idx
  on public.invitation_events(invitation_id, event_type, dedupe_key)
  where dedupe_key is not null;

create index if not exists invitation_events_invitation_created_idx on public.invitation_events(invitation_id, created_at desc);
create index if not exists invitation_events_type_created_idx on public.invitation_events(event_type, created_at desc);
create index if not exists rsvps_invitation_status_idx on public.rsvps(invitation_id, status);
create index if not exists rsvps_invitation_updated_idx on public.rsvps(invitation_id, updated_at desc);
create index if not exists guest_wishes_invitation_created_idx on public.guest_wishes(invitation_id, created_at desc);
create index if not exists invitations_user_updated_id_idx on public.invitations(user_id, updated_at desc, id);
create index if not exists invitations_user_first_published_updated_idx on public.invitations(user_id, first_published_at, updated_at desc);
create index if not exists invitations_user_template_idx on public.invitations(user_id, template_id);
create index if not exists invitations_lifecycle_updated_idx on public.invitations(lifecycle_status, updated_at desc);

create extension if not exists pg_trgm;
create index if not exists invitations_title_trgm_idx on public.invitations using gin (title gin_trgm_ops);
create index if not exists invitations_primary_name_trgm_idx on public.invitations using gin (primary_name gin_trgm_ops);
create index if not exists invitations_venue_name_trgm_idx on public.invitations using gin (venue_name gin_trgm_ops);
create index if not exists invitation_templates_name_trgm_idx on public.invitation_templates using gin (name gin_trgm_ops);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('invitation-draft-images', 'invitation-draft-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('invitation-draft-music', 'invitation-draft-music', false, 10485760, array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users_manage_own_invitation_draft_images" on storage.objects;
create policy "users_manage_own_invitation_draft_images" on storage.objects
for all to authenticated
using (
  bucket_id = 'invitation-draft-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'invitation-draft-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users_manage_own_invitation_draft_music" on storage.objects;
create policy "users_manage_own_invitation_draft_music" on storage.objects
for all to authenticated
using (
  bucket_id = 'invitation-draft-music'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'invitation-draft-music'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.can_publish_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_is_free boolean;
  v_has_paid boolean;
begin
  select coalesce(t.is_free, false) into v_is_free
  from public.invitations i
  join public.invitation_templates t on i.template_id = t.id
  where i.id = p_invitation_id;

  if v_is_free then
    return true;
  end if;

  select exists (
    select 1
    from public.payments p
    where p.invitation_id = p_invitation_id
      and p.status in ('paid', 'captured', 'publish_pending', 'published', 'recovery_pending')
      and p.payment_state in ('captured', 'refunded')
  ) into v_has_paid;

  return v_has_paid;
end;
$$;

create or replace function public.finalize_paid_invitation_publish(
  p_payment_id uuid,
  p_user_id uuid,
  p_invitation_id uuid,
  p_template_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount_paise integer,
  p_currency text,
  p_provider_status text,
  p_provider_payload jsonb,
  p_publish_patch jsonb,
  p_actor_type text default 'system',
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_invitation public.invitations%rowtype;
  v_existing_payment uuid;
  v_previous jsonb;
  v_updated public.invitations%rowtype;
  v_now timestamptz := now();
  v_publish_error text;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'Payment attempt not found' using errcode = 'P0002';
  end if;

  select * into v_invitation
  from public.invitations
  where id = p_invitation_id
  for update;

  if v_invitation.id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if v_payment.user_id <> p_user_id
    or v_payment.invitation_id <> p_invitation_id
    or v_payment.template_id is distinct from p_template_id
    or v_payment.amount_paise <> p_amount_paise
    or upper(v_payment.currency) <> upper(p_currency)
    or v_payment.provider_order_id <> p_provider_order_id
    or v_invitation.user_id <> p_user_id
    or v_invitation.template_id is distinct from p_template_id then
    update public.payments
    set status = 'manual_review',
        recovery_state = 'manual_review',
        last_error = 'Payment verification mismatch',
        updated_at = v_now
    where id = v_payment.id;
    raise exception 'Payment verification mismatch' using errcode = '22000';
  end if;

  if lower(coalesce(p_provider_status, '')) not in ('captured', 'authorized') then
    update public.payments
    set status = 'failed',
        payment_state = 'failed',
        provider_status = p_provider_status,
        last_error = 'Provider payment is not captured or authorized',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('provider_payload', p_provider_payload),
        updated_at = v_now
    where id = v_payment.id;
    raise exception 'Provider payment is not captured or authorized' using errcode = '22000';
  end if;

  select id into v_existing_payment
  from public.payments
  where provider_payment_id = p_provider_payment_id
    and id <> v_payment.id
  limit 1;

  if v_existing_payment is not null then
    update public.payments
    set status = 'manual_review',
        recovery_state = 'manual_review',
        last_error = 'Provider payment id already attached to another payment',
        updated_at = v_now
    where id = v_payment.id;
    raise exception 'Provider payment id already attached to another payment' using errcode = '23505';
  end if;

  if v_payment.status = 'published' and v_invitation.status = 'published' then
    return jsonb_build_object(
      'status', 'published',
      'payment_id', v_payment.id,
      'invitation_id', v_invitation.id,
      'slug', v_invitation.slug,
      'published_at', v_invitation.published_at,
      'idempotent', true
    );
  end if;

  v_previous := jsonb_build_object(
    'status', v_payment.status,
    'payment_state', v_payment.payment_state,
    'publish_state', v_payment.publish_state,
    'recovery_state', v_payment.recovery_state,
    'refund_state', v_payment.refund_state,
    'invitation_status', v_invitation.status,
    'invitation_payment_status', v_invitation.payment_status
  );

  update public.payments
  set status = 'reconciling',
      payment_state = 'captured',
      publish_state = 'publish_pending',
      recovery_state = 'retrying',
      provider_payment_id = p_provider_payment_id,
      provider_status = p_provider_status,
      provider_captured_at = case when lower(p_provider_status) = 'captured' then coalesce(provider_captured_at, v_now) else provider_captured_at end,
      paid_at = coalesce(paid_at, v_now),
      reconciled_at = v_now,
      last_reconciliation_at = v_now,
      last_publish_attempt_at = v_now,
      publish_attempt_count = publish_attempt_count + 1,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('provider_payload', p_provider_payload),
      updated_at = v_now
  where id = v_payment.id;

  begin
    perform set_config('app.identity_checked', 'on', true);

    update public.invitations
    set
      slug = coalesce(p_publish_patch->>'slug', slug),
      status = 'published',
      lifecycle_status = 'published',
      event_status = 'published',
      published_at = coalesce(nullif(p_publish_patch->>'published_at', '')::timestamptz, published_at, v_now),
      first_published_at = coalesce(nullif(p_publish_patch->>'first_published_at', '')::timestamptz, first_published_at, v_now),
      first_payment_id = coalesce(nullif(p_publish_patch->>'first_payment_id', '')::uuid, first_payment_id, v_payment.id),
      publish_version = coalesce((p_publish_patch->>'publish_version')::integer, publish_version + 1),
      first_publish_version = coalesce((p_publish_patch->>'first_publish_version')::integer, first_publish_version, publish_version + 1),
      payment_status = 'paid',
      original_category = case when p_publish_patch ? 'original_category' then p_publish_patch->>'original_category' else original_category end,
      original_primary_name = case when p_publish_patch ? 'original_primary_name' then p_publish_patch->>'original_primary_name' else original_primary_name end,
      original_secondary_name = case when p_publish_patch ? 'original_secondary_name' then nullif(p_publish_patch->>'original_secondary_name', '') else original_secondary_name end,
      original_event_date = case when p_publish_patch ? 'original_event_date' then nullif(p_publish_patch->>'original_event_date', '') else original_event_date end,
      original_template_id = case when p_publish_patch ? 'original_template_id' then nullif(p_publish_patch->>'original_template_id', '')::uuid else original_template_id end,
      event_snapshot = case when p_publish_patch ? 'event_snapshot' then p_publish_patch->'event_snapshot' else event_snapshot end,
      identity_snapshot = case when p_publish_patch ? 'identity_snapshot' then p_publish_patch->'identity_snapshot' else identity_snapshot end,
      identity_fingerprint = case when p_publish_patch ? 'identity_fingerprint' then p_publish_patch->>'identity_fingerprint' else identity_fingerprint end,
      event_change_score = coalesce((p_publish_patch->>'event_change_score')::integer, event_change_score),
      change_risk_status = coalesce(p_publish_patch->>'change_risk_status', change_risk_status),
      updated_at = v_now
    where id = p_invitation_id
      and user_id = p_user_id
    returning * into v_updated;

    if v_updated.id is null then
      raise exception 'Invitation publish update failed' using errcode = 'P0002';
    end if;

    update public.payments
    set status = 'published',
        publish_state = 'published',
        recovery_state = 'recovered',
        refund_state = 'none',
        last_error = null,
        next_reconciliation_at = null,
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
      correlation_id
    ) values (
      v_payment.id,
      p_invitation_id,
      p_user_id,
      coalesce(p_actor_type, 'system'),
      'finalize_paid_invitation_publish',
      v_previous,
      jsonb_build_object('payment_status', 'published', 'invitation_status', 'published'),
      p_correlation_id
    );

    return jsonb_build_object(
      'status', 'published',
      'payment_id', v_payment.id,
      'invitation_id', p_invitation_id,
      'slug', v_updated.slug,
      'published_at', v_updated.published_at,
      'idempotent', false
    );
  exception
    when others then
      get stacked diagnostics v_publish_error = message_text;

      update public.payments
      set status = case when publish_attempt_count >= 5 then 'manual_review' else 'recovery_pending' end,
          payment_state = 'captured',
          publish_state = 'publish_pending',
          recovery_state = case when publish_attempt_count >= 5 then 'manual_review' else 'pending' end,
          last_error = v_publish_error,
          next_reconciliation_at = v_now + interval '15 minutes',
          updated_at = v_now
      where id = v_payment.id;

      update public.invitations
      set payment_status = 'recovery_pending',
          first_payment_id = coalesce(first_payment_id, v_payment.id),
          updated_at = v_now
      where id = p_invitation_id;

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
        p_invitation_id,
        p_user_id,
        coalesce(p_actor_type, 'system'),
        'finalize_paid_invitation_publish_recovery_pending',
        v_previous,
        jsonb_build_object('payment_status', 'recovery_pending', 'invitation_payment_status', 'recovery_pending'),
        v_publish_error,
        p_correlation_id
      );

      return jsonb_build_object(
        'status', 'recovery_pending',
        'payment_id', v_payment.id,
        'invitation_id', p_invitation_id,
        'error', v_publish_error,
        'message', 'Your payment was successful, but publishing is still being completed. Please do not pay again.'
      );
  end;
end;
$$;

revoke all on function public.finalize_paid_invitation_publish(uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, jsonb, text, text) from public;
revoke all on function public.finalize_paid_invitation_publish(uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, jsonb, text, text) from authenticated;
grant execute on function public.finalize_paid_invitation_publish(uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, jsonb, text, text) to service_role;
