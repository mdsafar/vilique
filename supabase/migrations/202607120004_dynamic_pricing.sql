-- Migration: Dynamic database-driven pricing architecture

-- 1. Alter invitation_templates table to support dynamic pricing & metadata
alter table public.invitation_templates
  add column if not exists slug text,
  add column if not exists is_paid boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2. Sync columns for compatibility with existing records
update public.invitation_templates
set slug = template_key,
    is_paid = is_premium;

-- 3. Add unique constraint and set slug as non-nullable
alter table public.invitation_templates
  add constraint invitation_templates_slug_key unique (slug),
  alter column slug set not null;

-- 4. Seed and update template names, pricing, and paid properties
-- Update existing templates
update public.invitation_templates
set name = 'Pastel Floral',
    price_paise = 4900,
    is_paid = true,
    is_premium = true,
    is_free = false
where template_key = 'pastel-floral-wedding';

update public.invitation_templates
set name = 'Luxury Wedding',
    price_paise = 4900,
    is_paid = true,
    is_premium = true,
    is_free = false
where template_key = 'luxury-wedding';

update public.invitation_templates
set price_paise = 4900,
    is_paid = true,
    is_premium = true,
    is_free = false
where template_key in ('modern-engagement', 'corporate-evening', 'festival-lantern', 'graduation-gala', 'custom-moonlight');

update public.invitation_templates
set price_paise = 0,
    is_paid = false,
    is_premium = false,
    is_free = true
where template_key in ('birthday-pop', 'housewarming-noor', 'baby-clouds');

-- Insert new requested templates if they do not exist
insert into public.invitation_templates (
  template_key,
  slug,
  name,
  category,
  price_paise,
  currency,
  is_paid,
  is_premium,
  is_free,
  is_active,
  metadata
) values
  (
    'modern-wedding',
    'modern-wedding',
    'Modern Wedding',
    'wedding',
    6900,
    'INR',
    true,
    true,
    false,
    true,
    '{}'::jsonb
  ),
  (
    'minimal-wedding',
    'minimal-wedding',
    'Minimal Wedding',
    'wedding',
    9900,
    'INR',
    true,
    true,
    false,
    true,
    '{}'::jsonb
  ),
  (
    'free-template',
    'free-template',
    'Free Template',
    'wedding',
    0,
    'INR',
    false,
    false,
    true,
    true,
    '{}'::jsonb
  )
on conflict (template_key) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  price_paise = excluded.price_paise,
  is_paid = excluded.is_paid,
  is_premium = excluded.is_premium,
  is_free = excluded.is_free,
  is_active = excluded.is_active,
  updated_at = now();
