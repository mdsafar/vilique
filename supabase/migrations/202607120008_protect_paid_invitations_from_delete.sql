-- Protect paid invitations from accidental deletion.

create or replace function public.prevent_paid_invitation_delete()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.payment_status = 'paid'
     or old.first_published_at is not null
     or exists (
       select 1
       from public.payments p
       where p.invitation_id = old.id
         and p.status = 'paid'
     ) then
    raise exception 'Paid invitations cannot be deleted. Archive or edit instead.'
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

drop trigger if exists protect_paid_invitation_delete on public.invitations;
create trigger protect_paid_invitation_delete
before delete on public.invitations
for each row execute function public.prevent_paid_invitation_delete();
