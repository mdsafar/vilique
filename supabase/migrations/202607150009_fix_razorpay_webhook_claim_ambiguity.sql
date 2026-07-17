-- Remove ambiguous column references from the Razorpay webhook claim RPC.

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_namespace namespace_row
      on namespace_row.oid = constraint_row.connamespace
    where namespace_row.nspname = 'public'
      and constraint_row.conrelid = 'public.webhook_events'::regclass
      and constraint_row.conname = 'webhook_events_provider_event_id_key'
  ) then
    alter table public.webhook_events
      add constraint webhook_events_provider_event_id_key
      unique using index webhook_events_provider_event_id_key;
  end if;
end;
$$;

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
    insert into public.webhook_events as webhook_event (
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
    on conflict on constraint webhook_events_provider_event_id_key do update
      set
        event_type = excluded.event_type,
        payload = excluded.payload,
        processing_status = 'processing',
        attempt_count = webhook_event.attempt_count + 1,
        processing_started_at = now(),
        processed_at = null,
        failed_at = null,
        last_error = null,
        error_message = null
      where webhook_event.provider = 'razorpay'
        and (
          webhook_event.processing_status in ('pending', 'failed')
          or (
            webhook_event.processing_status = 'processing'
            and webhook_event.processing_started_at < now() - p_stale_after
          )
        )
    returning
      webhook_event.id as claimed_id,
      webhook_event.provider_event_id as claimed_provider_event_id,
      webhook_event.event_type as claimed_event_type,
      webhook_event.processing_status as claimed_processing_status,
      webhook_event.attempt_count as claimed_attempt_count,
      true as claimed_result
  )
  select
    claimed_event.claimed_id as id,
    claimed_event.claimed_provider_event_id as provider_event_id,
    claimed_event.claimed_event_type as event_type,
    claimed_event.claimed_processing_status as processing_status,
    claimed_event.claimed_attempt_count as attempt_count,
    claimed_event.claimed_result as claimed
  from claimed_event
  union all
  select
    existing_event.id as id,
    existing_event.provider_event_id as provider_event_id,
    existing_event.event_type as event_type,
    existing_event.processing_status as processing_status,
    existing_event.attempt_count as attempt_count,
    false as claimed
  from public.webhook_events as existing_event
  where existing_event.provider = 'razorpay'
    and existing_event.provider_event_id = p_provider_event_id
    and not exists (select 1 from claimed_event)
  limit 1;
end;
$$;

grant execute on function public.claim_razorpay_webhook_event(text, text, jsonb, interval) to service_role;
