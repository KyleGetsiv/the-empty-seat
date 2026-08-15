-- 0012_earnings_extraction.sql
-- Phase 4, module 4.1: data model for the earnings extraction pipeline.
--
-- earnings_events: one row per source document (SEC filing, call transcript,
-- shareholder letter). company_id is the filer (Alphabet); subject_company_id
-- is the company the mentions are about (Waymo). accession_number is the SEC
-- id and the dedupe key for filings.
--
-- waymo_mentions: extracted references, one per quote. Nothing is public
-- until review_status = 'approved' (RLS enforces this for anon). Numeric
-- mentions promoted on approval write a disclosed_metrics row (the site's
-- existing point-in-time disclosure table; the v1 plan's separate
-- extracted_metrics table is dropped in favor of that) and link back via
-- disclosed_metric_id.

create table earnings_events (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id),
  subject_company_id  uuid not null references companies(id),
  fiscal_period       text not null,
  event_type          text not null check (event_type in
                        ('10-K','10-Q','8-K','earnings_call','shareholder_letter',
                         'investor_day','press_release')),
  event_date          date not null,
  source_id           uuid references sources(id),
  storage_key         text,
  accession_number    text,
  processing_status   text not null default 'pending' check (processing_status in
                        ('pending','extracted','reviewed','failed')),
  extraction_version  int,
  extraction_model    text,
  processed_at        timestamptz,
  error               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (accession_number)
);

create table waymo_mentions (
  id                  uuid primary key default gen_random_uuid(),
  earnings_event_id   uuid not null references earnings_events(id) on delete cascade,
  mention_type        text not null check (mention_type in
                        ('revenue_reference','city_count','ride_count','fleet_size','capex',
                         'operating_loss','strategic_commentary','forward_guidance',
                         'competitive_reference','safety_reference','other')),
  quote_text          text not null,
  speaker             text,
  extracted_metric    jsonb,
  confidence          text not null check (confidence in ('high','medium','low')),
  kyle_annotation     text,
  review_status       text not null default 'pending' check (review_status in
                        ('pending','approved','rejected')),
  page_or_timestamp   text,
  disclosed_metric_id uuid references disclosed_metrics(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index waymo_mentions_event_idx on waymo_mentions(earnings_event_id);
create index waymo_mentions_review_idx on waymo_mentions(review_status);
create index earnings_events_status_idx on earnings_events(processing_status);

-- triggers
create trigger earnings_events_updated_at
  before update on earnings_events
  for each row execute function set_updated_at();
create trigger waymo_mentions_updated_at
  before update on waymo_mentions
  for each row execute function set_updated_at();
create trigger audit_earnings_events
  after insert or update or delete on earnings_events
  for each row execute function audit_trigger_fn();
create trigger audit_waymo_mentions
  after insert or update or delete on waymo_mentions
  for each row execute function audit_trigger_fn();

-- RLS
alter table earnings_events enable row level security;
alter table waymo_mentions  enable row level security;

create policy "public select earnings_events"
  on earnings_events for select using (true);

-- Mentions: anon sees approved only; admin sees all (policies are OR-d),
-- mirroring the milestones pattern.
create policy "public select approved waymo_mentions"
  on waymo_mentions for select using (review_status = 'approved');
create policy "admin select all waymo_mentions"
  on waymo_mentions for select using (is_admin());

create policy "admin insert earnings_events" on earnings_events for insert with check (is_admin());
create policy "admin update earnings_events" on earnings_events for update using (is_admin());
create policy "admin delete earnings_events" on earnings_events for delete using (is_admin());
create policy "admin insert waymo_mentions" on waymo_mentions for insert with check (is_admin());
create policy "admin update waymo_mentions" on waymo_mentions for update using (is_admin());
create policy "admin delete waymo_mentions" on waymo_mentions for delete using (is_admin());
