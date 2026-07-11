create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invitation_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  category text not null,
  description text,
  preview_image_url text,
  accent_color text,
  is_premium boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.invitation_templates(id) on delete set null,
  slug text not null unique,
  category text not null,
  title text not null,
  primary_name text not null,
  secondary_name text,
  event_date date,
  event_time text,
  venue_name text,
  venue_address text,
  map_link text,
  phone text,
  whatsapp text,
  message text,
  music_url text,
  cover_image_url text,
  gallery_urls jsonb not null default '[]'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  sections jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_name text not null,
  guest_phone text,
  status text not null check (status in ('accepted', 'declined', 'maybe')),
  guest_count int not null default 1 check (guest_count between 1 and 10),
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_wishes (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_name text not null,
  message text not null,
  is_approved boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.invitation_events (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'share', 'music_play', 'map_click', 'call_click', 'whatsapp_click', 'rsvp_submit')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists invitations_user_id_idx on public.invitations(user_id);
create index if not exists invitations_slug_status_idx on public.invitations(slug, status);
create index if not exists rsvps_invitation_id_idx on public.rsvps(invitation_id);
create index if not exists guest_wishes_invitation_id_idx on public.guest_wishes(invitation_id);
create index if not exists invitation_events_invitation_id_type_idx on public.invitation_events(invitation_id, event_type);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists invitation_templates_set_updated_at on public.invitation_templates;
create trigger invitation_templates_set_updated_at
before update on public.invitation_templates
for each row execute function public.set_updated_at();

drop trigger if exists invitations_set_updated_at on public.invitations;
create trigger invitations_set_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_for_new_user on auth.users;
create trigger create_profile_for_new_user
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.invitation_templates enable row level security;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.guest_wishes enable row level security;
alter table public.invitation_events enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "templates_select_active" on public.invitation_templates
for select to anon, authenticated
using (is_active = true);

create policy "templates_admin_insert" on public.invitation_templates
for insert to authenticated
with check (public.is_admin());

create policy "templates_admin_update" on public.invitation_templates
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "templates_admin_delete" on public.invitation_templates
for delete to authenticated
using (public.is_admin());

create policy "invitations_insert_own" on public.invitations
for insert to authenticated
with check (user_id = auth.uid());

create policy "invitations_select_own_or_published" on public.invitations
for select to anon, authenticated
using (status = 'published' or user_id = auth.uid());

create policy "invitations_update_own" on public.invitations
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "invitations_delete_own" on public.invitations
for delete to authenticated
using (user_id = auth.uid());

create policy "rsvps_public_insert_published" on public.rsvps
for insert to anon, authenticated
with check (
  exists (
    select 1 from public.invitations
    where invitations.id = rsvps.invitation_id
      and invitations.status = 'published'
  )
);

create policy "rsvps_owner_select" on public.rsvps
for select to authenticated
using (
  exists (
    select 1 from public.invitations
    where invitations.id = rsvps.invitation_id
      and invitations.user_id = auth.uid()
  )
);

create policy "wishes_public_insert_published" on public.guest_wishes
for insert to anon, authenticated
with check (
  exists (
    select 1 from public.invitations
    where invitations.id = guest_wishes.invitation_id
      and invitations.status = 'published'
  )
);

create policy "wishes_public_select_approved" on public.guest_wishes
for select to anon, authenticated
using (
  is_approved = true
  and exists (
    select 1 from public.invitations
    where invitations.id = guest_wishes.invitation_id
      and invitations.status = 'published'
  )
);

create policy "wishes_owner_manage" on public.guest_wishes
for all to authenticated
using (
  exists (
    select 1 from public.invitations
    where invitations.id = guest_wishes.invitation_id
      and invitations.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.invitations
    where invitations.id = guest_wishes.invitation_id
      and invitations.user_id = auth.uid()
  )
);

create policy "events_public_insert_published" on public.invitation_events
for insert to anon, authenticated
with check (
  exists (
    select 1 from public.invitations
    where invitations.id = invitation_events.invitation_id
      and invitations.status = 'published'
  )
);

create policy "events_owner_select" on public.invitation_events
for select to authenticated
using (
  exists (
    select 1 from public.invitations
    where invitations.id = invitation_events.invitation_id
      and invitations.user_id = auth.uid()
  )
);

insert into public.invitation_templates (
  template_key,
  name,
  category,
  description,
  accent_color,
  is_premium,
  is_active
) values
  ('pastel-floral-wedding', 'Pastel Floral Wedding', 'wedding', 'Soft pastel floral animated wedding invitation', '#b99aad', true, true),
  ('luxury-wedding', 'Luxury Wedding', 'wedding', 'A refined black-and-gold wedding suite for evening receptions and formal celebrations.', '#b8894d', true, true),
  ('birthday-pop', 'Birthday Pop', 'birthday', 'A vibrant birthday invite with playful motion, gallery moments and party-ready RSVP.', '#7c3aed', false, true),
  ('modern-engagement', 'Modern Engagement', 'engagement', 'A calm editorial engagement layout with story sections, calendar actions and maps.', '#3d6b74', true, true),
  ('housewarming-noor', 'Noor Housewarming', 'housewarming', 'A warm housewarming invitation with location-first details and family-friendly RSVP.', '#2f6f5e', false, true),
  ('corporate-evening', 'Corporate Evening', 'corporate', 'A polished corporate event page with agenda, speaker highlights and RSVP tracking.', '#2453ff', true, true),
  ('festival-lantern', 'Festival Lantern', 'festival', 'A warm festive invitation with glowing sections, family notes and share-ready details.', '#d4572f', true, true),
  ('baby-clouds', 'Baby Clouds', 'baby_shower', 'A soft baby shower invite with pastel clouds, registry links and gentle RSVP flows.', '#8bb9d6', false, true),
  ('graduation-gala', 'Graduation Gala', 'graduation', 'A polished graduation invite with milestone timeline, gallery and celebration details.', '#173b57', true, true),
  ('custom-moonlight', 'Moonlight Custom', 'custom', 'A flexible premium template for custom ceremonies, parties and private gatherings.', '#6152a3', true, true)
on conflict (template_key) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  accent_color = excluded.accent_color,
  is_premium = excluded.is_premium,
  is_active = excluded.is_active,
  updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('invitation-images', 'invitation-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('invitation-music', 'invitation-music', true, 10485760, array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']),
  ('template-assets', 'template-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public_read_invitation_images" on storage.objects
for select to anon, authenticated
using (bucket_id = 'invitation-images');

create policy "public_read_invitation_music" on storage.objects
for select to anon, authenticated
using (bucket_id = 'invitation-music');

create policy "public_read_template_assets" on storage.objects
for select to anon, authenticated
using (bucket_id = 'template-assets');

create policy "users_manage_own_invitation_images" on storage.objects
for all to authenticated
using (
  bucket_id = 'invitation-images'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'invitation-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "users_manage_own_invitation_music" on storage.objects
for all to authenticated
using (
  bucket_id = 'invitation-music'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'invitation-music'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "admins_manage_template_assets" on storage.objects
for all to authenticated
using (bucket_id = 'template-assets' and public.is_admin())
with check (bucket_id = 'template-assets' and public.is_admin());

