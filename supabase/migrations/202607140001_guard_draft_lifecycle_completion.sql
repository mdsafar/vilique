-- Guard invitation lifecycle completion with publication history.
--
-- Dry run for rows this migration repairs:
-- select
--   id,
--   title,
--   status,
--   lifecycle_status,
--   event_status,
--   event_date,
--   event_time,
--   event_timezone,
--   first_published_at,
--   published_at
-- from public.invitations
-- where first_published_at is null
--   and published_at is null
--   and status <> 'archived'
--   and (
--     lifecycle_status in ('published', 'completed', 'unpublished')
--     or event_status in ('published', 'completed', 'unpublished')
--     or status = 'published'
--   );

create or replace function public.vilique_is_completed_invitation(invite public.invitations)
returns boolean
language sql
stable
as $$
  select (invite.first_published_at is not null or invite.published_at is not null)
     and (
       invite.lifecycle_status = 'completed'
       or invite.event_status = 'completed'
       or public.vilique_event_completed(invite.event_date, invite.event_time, invite.event_timezone)
     );
$$;

create or replace function public.prevent_completed_invitation_update()
returns trigger
language plpgsql
security definer
as $$
declare
  bypass text := coalesce(current_setting('app.completed_lock_bypass', true), '');
  was_completed boolean;
  is_marking_completed boolean;
begin
  if bypass = 'on' then
    return new;
  end if;

  was_completed := public.vilique_is_completed_invitation(old);
  is_marking_completed :=
    (old.first_published_at is not null or old.published_at is not null)
    and not (old.lifecycle_status = 'completed' or old.event_status = 'completed')
    and public.vilique_event_completed(old.event_date, old.event_time, old.event_timezone)
    and new.lifecycle_status = 'completed'
    and new.event_status = 'completed'
    and new.status is not distinct from old.status
    and new.event_date is not distinct from old.event_date
    and new.event_time is not distinct from old.event_time
    and new.event_timezone is not distinct from old.event_timezone
    and new.category is not distinct from old.category
    and new.title is not distinct from old.title
    and new.primary_name is not distinct from old.primary_name
    and new.secondary_name is not distinct from old.secondary_name
    and new.venue_name is not distinct from old.venue_name
    and new.venue_address is not distinct from old.venue_address
    and new.map_link is not distinct from old.map_link
    and new.phone is not distinct from old.phone
    and new.secondary_phone is not distinct from old.secondary_phone
    and new.whatsapp is not distinct from old.whatsapp
    and new.message is not distinct from old.message
    and new.template_id is not distinct from old.template_id
    and new.theme is not distinct from old.theme
    and new.sections is not distinct from old.sections
    and new.cover_image_url is not distinct from old.cover_image_url
    and new.gallery_urls is not distinct from old.gallery_urls
    and new.music_url is not distinct from old.music_url
    and new.slug is not distinct from old.slug
    and new.published_at is not distinct from old.published_at
    and new.first_published_at is not distinct from old.first_published_at;

  if was_completed and not is_marking_completed then
    raise exception 'Completed invitations cannot be edited or reactivated.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

update public.invitations
set
  status = 'draft',
  lifecycle_status = 'draft',
  event_status = 'draft',
  completed_at = null,
  updated_at = now()
where first_published_at is null
  and published_at is null
  and status <> 'archived'
  and (
    lifecycle_status in ('published', 'completed', 'unpublished')
    or event_status in ('published', 'completed', 'unpublished')
    or status = 'published'
  );
