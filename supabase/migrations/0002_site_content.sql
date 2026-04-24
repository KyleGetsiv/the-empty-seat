-- Module 1.1: site_content key/value table for editorial copy.
-- Used for landing-page thesis paragraphs and any future editorial blocks
-- that need to be admin-editable without a code deploy.

create table if not exists public.site_content (
  key text primary key,
  markdown_body text not null,
  updated_at timestamptz not null default now()
);

-- updated_at maintenance
create or replace function public.set_site_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_site_content_updated_at on public.site_content;
create trigger trg_site_content_updated_at
  before update on public.site_content
  for each row execute function public.set_site_content_updated_at();

-- Audit log trigger, matching audit_trigger_fn() from 0001_initial_schema.sql.
drop trigger if exists trg_site_content_audit on public.site_content;
create trigger trg_site_content_audit
  after insert or update or delete on public.site_content
  for each row execute function public.audit_trigger_fn();

-- RLS: public read, admin write.
alter table public.site_content enable row level security;

drop policy if exists "site_content read for everyone" on public.site_content;
create policy "site_content read for everyone"
  on public.site_content
  for select
  to anon, authenticated
  using (true);

drop policy if exists "site_content write for admins" on public.site_content;
create policy "site_content write for admins"
  on public.site_content
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
