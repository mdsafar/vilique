-- Stable invoice and refund receipt numbering for private payment documents.

alter table public.payments
  add column if not exists invoice_number text,
  add column if not exists invoice_issued_at timestamptz,
  add column if not exists invoice_version integer not null default 1,
  add column if not exists refund_receipt_number text,
  add column if not exists refund_receipt_issued_at timestamptz,
  add column if not exists refund_reason_public text;

create unique index if not exists payments_invoice_number_key
  on public.payments(invoice_number)
  where invoice_number is not null;

create unique index if not exists payments_refund_receipt_number_key
  on public.payments(refund_receipt_number)
  where refund_receipt_number is not null;

create index if not exists payments_document_lookup_idx
  on public.payments(user_id, id, invoice_number, refund_receipt_number);

create table if not exists public.payment_document_counters (
  document_type text primary key check (document_type in ('invoice', 'refund')),
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.payment_document_counters(document_type, last_value)
values ('invoice', 0), ('refund', 0)
on conflict (document_type) do nothing;

alter table public.payment_document_counters enable row level security;

create or replace function public.assign_payment_invoice_number(p_payment_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_next bigint;
  v_number text;
begin
  select invoice_number
    into v_existing
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_existing is not null then
    return v_existing;
  end if;

  update public.payment_document_counters
  set last_value = last_value + 1,
      updated_at = now()
  where document_type = 'invoice'
  returning last_value into v_next;

  v_number := 'VIL-INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 6, '0');

  update public.payments
  set invoice_number = v_number,
      invoice_issued_at = coalesce(invoice_issued_at, now()),
      invoice_version = coalesce(invoice_version, 1)
  where id = p_payment_id;

  return v_number;
end;
$$;

create or replace function public.assign_payment_refund_receipt_number(p_payment_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_next bigint;
  v_number text;
begin
  select refund_receipt_number
    into v_existing
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_existing is not null then
    return v_existing;
  end if;

  update public.payment_document_counters
  set last_value = last_value + 1,
      updated_at = now()
  where document_type = 'refund'
  returning last_value into v_next;

  v_number := 'VIL-REF-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 6, '0');

  update public.payments
  set refund_receipt_number = v_number,
      refund_receipt_issued_at = coalesce(refund_receipt_issued_at, now())
  where id = p_payment_id;

  return v_number;
end;
$$;

grant execute on function public.assign_payment_invoice_number(uuid) to service_role;
grant execute on function public.assign_payment_refund_receipt_number(uuid) to service_role;
