create or replace function public.vilique_slugify_invitation_text(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(value, '')), '&', ' and ', 'g'),
      '[^a-z0-9]+',
      '-',
      'g'
    ),
    '-+',
    '-',
    'g'
  ));
$$;

create or replace function public.vilique_build_invitation_slug(
  p_readable_name text,
  p_invitation_id uuid,
  p_max_length integer default 80,
  p_suffix_length integer default 8
)
returns text
language plpgsql
immutable
as $$
declare
  suffix text;
  base text;
  base_length integer;
begin
  suffix := left(replace(lower(p_invitation_id::text), '-', ''), p_suffix_length);
  if suffix = '' then
    raise exception 'SLUG_GENERATION_FAILED';
  end if;

  base_length := greatest(1, p_max_length - length(suffix) - 1);
  base := trim(trailing '-' from left(public.vilique_slugify_invitation_text(p_readable_name), base_length));

  return concat(coalesce(nullif(base, ''), 'invitation'), '-', suffix);
end;
$$;

create or replace function public.vilique_invitation_slug_audit()
returns table (
  invitation_id uuid,
  title text,
  slug text,
  status text,
  lifecycle_status text,
  event_status text,
  created_at timestamptz,
  first_published_at timestamptz,
  duplicate_count bigint,
  issue_codes text[]
)
language sql
stable
as $$
  with slug_counts as (
    select lower(slug) as normalized_slug, count(*) as duplicate_count
    from public.invitations
    group by lower(slug)
  )
  select
    i.id,
    i.title,
    i.slug,
    i.status,
    i.lifecycle_status,
    i.event_status,
    i.created_at,
    i.first_published_at,
    sc.duplicate_count,
    array_remove(array[
      case when i.slug is null or btrim(i.slug) = '' then 'EMPTY_SLUG' end,
      case when lower(i.slug) in ('undefined', 'null') then 'PLACEHOLDER_SLUG' end,
      case when i.slug <> lower(i.slug) then 'UPPERCASE_SLUG' end,
      case when i.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then 'INVALID_FORMAT' end,
      case when i.slug ~ '-$' then 'TRAILING_HYPHEN' end,
      case when i.slug !~ '-[a-f0-9]{8}$' then 'MISSING_UUID_SUFFIX' end,
      case when length(i.slug) > 80 then 'TOO_LONG' end,
      case when sc.duplicate_count > 1 then 'DUPLICATE_NORMALIZED_SLUG' end
    ], null) as issue_codes
  from public.invitations i
  join slug_counts sc on sc.normalized_slug = lower(i.slug)
  where
    i.slug is null
    or btrim(i.slug) = ''
    or lower(i.slug) in ('undefined', 'null')
    or i.slug <> lower(i.slug)
    or i.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or i.slug ~ '-$'
    or i.slug !~ '-[a-f0-9]{8}$'
    or length(i.slug) > 80
    or sc.duplicate_count > 1
  order by i.created_at, i.id;
$$;

create or replace function public.vilique_repair_draft_invitation_slugs()
returns table (
  invitation_id uuid,
  old_slug text,
  new_slug text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with broken_drafts as (
    select audit.invitation_id, i.slug as old_slug
    from public.vilique_invitation_slug_audit() audit
    join public.invitations i on i.id = audit.invitation_id
    where i.first_published_at is null
      and i.published_at is null
      and i.status <> 'published'
  ),
  repaired as (
    update public.invitations i
    set slug = public.vilique_build_invitation_slug(
          coalesce(nullif(concat_ws(' ', i.primary_name, i.secondary_name), ''), i.title, 'invitation'),
          i.id
        ),
        updated_at = now()
    from broken_drafts b
    where i.id = b.invitation_id
    returning i.id, b.old_slug, i.slug as new_slug
  )
  select repaired.id, repaired.old_slug, repaired.new_slug
  from repaired;
end;
$$;

revoke all on function public.vilique_repair_draft_invitation_slugs() from public;
revoke all on function public.vilique_repair_draft_invitation_slugs() from authenticated;
grant execute on function public.vilique_repair_draft_invitation_slugs() to service_role;
