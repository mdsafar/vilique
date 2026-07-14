-- Keep explicit drafts editable even when legacy publication timestamps exist.
--
-- Some draft rows can carry historical published_at/first_published_at values
-- from older flows. They should not be treated as completed unless their
-- lifecycle/event state has moved out of draft.

create or replace function public.vilique_is_completed_invitation(invite public.invitations)
returns boolean
language sql
stable
as $$
  select not (
       invite.status = 'draft'
       and invite.lifecycle_status = 'draft'
       and invite.event_status = 'draft'
     )
     and (invite.first_published_at is not null or invite.published_at is not null)
     and (
       invite.lifecycle_status = 'completed'
       or invite.event_status = 'completed'
       or public.vilique_event_completed(invite.event_date, invite.event_time, invite.event_timezone)
     );
$$;

update public.invitations
set
  completed_at = null,
  updated_at = now()
where status = 'draft'
  and lifecycle_status = 'draft'
  and event_status = 'draft'
  and completed_at is not null;

notify pgrst, 'reload schema';
