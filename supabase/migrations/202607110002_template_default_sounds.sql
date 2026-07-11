-- Migration: Add default sound columns to invitation_templates
-- These columns store the public URLs of default audio assets
-- for each template, uploaded to the `template-assets` Supabase storage bucket.

alter table public.invitation_templates
    add column if not exists default_music_url text,
    add column if not exists default_tick_sound_url text;

-- Update the seed row for Pastel Floral Wedding.
update public.invitation_templates
set
    default_music_url      = '/audio/templates/pastel-floral-wedding/song.mp3',
    default_tick_sound_url = '/audio/global/tick-tock.mp3'
where template_key = 'pastel-floral-wedding';
