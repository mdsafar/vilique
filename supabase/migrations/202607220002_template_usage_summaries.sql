create or replace function public.get_template_usage_summaries(p_template_keys text[])
returns table (
  template_key text,
  usage_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    templates.template_key,
    count(distinct invitations.user_id)::bigint as usage_count
  from public.invitation_templates templates
  left join public.invitations invitations
    on invitations.template_id = templates.id
    and coalesce(invitations.first_published_at, invitations.published_at) is not null
  where templates.template_key = any(p_template_keys)
    and templates.is_active = true
  group by templates.template_key;
$$;

revoke all on function public.get_template_usage_summaries(text[]) from public;
grant execute on function public.get_template_usage_summaries(text[]) to anon, authenticated, service_role;
