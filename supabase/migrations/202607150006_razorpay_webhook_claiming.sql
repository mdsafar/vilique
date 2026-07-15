-- Harden Razorpay webhook event state, retries, and atomic claiming.

alter table public.webhook_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists last_error text;

update public.webhook_events
set last_error = coalesce(last_error, error_message)
where error_message is not null
  and last_error is null;

alter table public.webhook_events
  drop constraint if exists webhook_events_processing_status_check;

alter table public.webhook_events
  add constraint webhook_events_processing_status_check check (
    processing_status in ('pending', 'processing', 'processed', 'failed', 'ignored', 'manual_review')
  );

create unique index if not exists webhook_events_provider_event_id_key
  on public.webhook_events(provider_event_id);

create index if not exists webhook_events_processing_status_started_idx
  on public.webhook_events(processing_status, processing_started_at);

create or replace function public.claim_razorpay_webhook_event(
  p_provider_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_stale_after interval default interval '5 minutes'
)
returns table (
  id uuid,
  provider_event_id text,
  event_type text,
  processing_status text,
  attempt_count integer,
  claimed boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed_event as (
    insert into public.webhook_events (
      provider,
      provider_event_id,
      event_type,
      payload,
      processing_status,
      attempt_count,
      processing_started_at,
      processed_at,
      failed_at,
      last_error,
      error_message
    )
    values (
      'razorpay',
      p_provider_event_id,
      p_event_type,
      coalesce(p_payload, '{}'::jsonb),
      'processing',
      1,
      now(),
      null,
      null,
      null,
      null
    )
    on conflict (provider_event_id) do update
      set
        event_type = excluded.event_type,
        payload = excluded.payload,
        processing_status = 'processing',
        attempt_count = public.webhook_events.attempt_count + 1,
        processing_started_at = now(),
        processed_at = null,
        failed_at = null,
        last_error = null,
        error_message = null
      where public.webhook_events.provider = 'razorpay'
        and (
          public.webhook_events.processing_status in ('pending', 'failed')
          or (
            public.webhook_events.processing_status = 'processing'
            and public.webhook_events.processing_started_at < now() - p_stale_after
          )
        )
    returning
      public.webhook_events.id,
      public.webhook_events.provider_event_id,
      public.webhook_events.event_type,
      public.webhook_events.processing_status,
      public.webhook_events.attempt_count,
      true as claimed
  )
  select
    claimed_event.id,
    claimed_event.provider_event_id,
    claimed_event.event_type,
    claimed_event.processing_status,
    claimed_event.attempt_count,
    claimed_event.claimed
  from claimed_event
  union all
  select
    existing_event.id,
    existing_event.provider_event_id,
    existing_event.event_type,
    existing_event.processing_status,
    existing_event.attempt_count,
    false as claimed
  from public.webhook_events existing_event
  where existing_event.provider = 'razorpay'
    and existing_event.provider_event_id = p_provider_event_id
    and not exists (select 1 from claimed_event)
  limit 1;
end;
$$;

grant execute on function public.claim_razorpay_webhook_event(text, text, jsonb, interval) to service_role;
