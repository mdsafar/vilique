-- Migration: Alter payments table to make invitation_id nullable and set null on delete

-- 1. Drop the NOT NULL constraint on invitation_id in payments table
alter table public.payments alter column invitation_id drop not null;

-- 2. Drop the existing foreign key constraint that cascades on delete
alter table public.payments drop constraint if exists payments_invitation_id_fkey;

-- 3. Re-add the foreign key constraint but set it to set null on delete
alter table public.payments
  add constraint payments_invitation_id_fkey
  foreign key (invitation_id)
  references public.invitations(id)
  on delete set null;
