-- 0008_disclosed_metrics.sql
-- Module 2.3: first-class time series for disclosed operating metrics,
-- replacing the site_content latest_*_disclosed text convention.
-- Metric slugs by convention: 'weekly_rides', 'cumulative_trips',
-- 'fleet_size', 'cities_count'. Rows are point-in-time disclosures; the
-- latest company-attributed row per metric is the "current" value.
-- attribution distinguishes company-confirmed figures from third-party
-- ones (investor letters, media reports, analyst estimates); charts render
-- company rows as filled dots and third-party rows as open dots, and
-- headline surfaces (hero, KeyStats) use company rows only.

create table disclosed_metrics (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id),
  metric      text not null,
  value       numeric not null,
  as_of       date not null,
  scope       text not null default 'worldwide',
  attribution text not null default 'company'
              check (attribution in ('company', 'investor', 'media', 'analyst')),
  source_id   uuid references sources(id),
  stated_by   text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, metric, as_of)
);

create trigger disclosed_metrics_updated_at
  before update on disclosed_metrics
  for each row execute function set_updated_at();

create trigger audit_disclosed_metrics
  after insert or update or delete on disclosed_metrics
  for each row execute function audit_trigger_fn();

alter table disclosed_metrics enable row level security;

create policy "public select disclosed_metrics"
  on disclosed_metrics for select using (true);

create policy "admin insert disclosed_metrics"
  on disclosed_metrics for insert with check (is_admin());
create policy "admin update disclosed_metrics"
  on disclosed_metrics for update using (is_admin());
create policy "admin delete disclosed_metrics"
  on disclosed_metrics for delete using (is_admin());
