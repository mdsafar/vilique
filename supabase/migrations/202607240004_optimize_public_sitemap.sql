-- Support ordered, index-only reads for the public invitation sitemap.
create index if not exists invitations_public_sitemap_idx
on public.invitations (slug)
include (updated_at)
where status = 'published'
  and lifecycle_status <> 'unpublished'
  and event_status <> 'unpublished';
