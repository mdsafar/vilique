create table if not exists public.template_ratings (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.invitation_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  is_hidden boolean not null default false,
  moderation_reason text,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, template_id)
);

create index if not exists template_ratings_template_id_idx on public.template_ratings(template_id);
create index if not exists template_ratings_user_id_idx on public.template_ratings(user_id);
create index if not exists template_ratings_template_rating_idx on public.template_ratings(template_id, rating);
create index if not exists template_ratings_visible_template_idx
  on public.template_ratings(template_id)
  where is_hidden = false;

drop trigger if exists template_ratings_set_updated_at on public.template_ratings;
create trigger template_ratings_set_updated_at
before update on public.template_ratings
for each row execute function public.set_updated_at();

create or replace function public.can_rate_template(p_template_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invitation_templates templates
    join public.invitations invitations
      on invitations.template_id = templates.id
    where templates.id = p_template_id
      and templates.is_active = true
      and invitations.user_id = p_user_id
      and coalesce(invitations.first_published_at, invitations.published_at) is not null
  );
$$;

create or replace function public.get_template_rating_summaries(p_template_keys text[])
returns table (
  template_key text,
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    templates.template_key,
    round(avg(ratings.rating)::numeric, 1) as average_rating,
    count(ratings.id)::bigint as rating_count
  from public.invitation_templates templates
  left join public.template_ratings ratings
    on ratings.template_id = templates.id
    and ratings.is_hidden = false
  where templates.template_key = any(p_template_keys)
    and templates.is_active = true
  group by templates.template_key;
$$;

alter table public.template_ratings enable row level security;

create policy "template_ratings_select_own_or_admin" on public.template_ratings
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "template_ratings_insert_eligible_owner" on public.template_ratings
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_rate_template(template_id, auth.uid())
);

create policy "template_ratings_update_eligible_owner" on public.template_ratings
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and public.can_rate_template(template_id, auth.uid())
  )
);

create policy "template_ratings_delete_own_or_admin" on public.template_ratings
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());
