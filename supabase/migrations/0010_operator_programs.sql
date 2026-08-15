-- 0010_operator_programs.sql
-- Phase 3, module 3.1: competitive landscape data model.
--
-- A deployment program is the unit that appears on the landscape page: the
-- thing actually on the road. Programs are usually one company (Waymo,
-- Zoox, Tesla, Apollo Go) but can be several playing distinct roles
-- (Nuro supplies the driver, Lucid the vehicle, Uber owns the fleet and
-- runs the network). operator_program_roles captures that; single-company
-- programs hold every role themselves.
--
-- competitor_snapshots are point-in-time operational readings per program.
-- Every metric column is nullable by design: most operators disclose very
-- little, and the absence is itself information. disclosure_quality and
-- supervision make the confidence of each reading visible at the schema
-- level, per the site's attribution principle.

-- ---------------------------------------------------------------------------
-- companies: descriptive fields for the landscape table
-- ---------------------------------------------------------------------------

alter table companies
  add column hq_country     text,
  add column ownership      text,     -- e.g. 'Alphabet subsidiary', 'Nasdaq: PONY'
  add column status_summary text;     -- one admin-maintained editorial sentence

-- ---------------------------------------------------------------------------
-- operator_programs and roles
-- ---------------------------------------------------------------------------

create table operator_programs (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,       -- e.g. 'waymo-one', 'uber-nuro-lucid'
  display_name  text not null,              -- e.g. 'Uber premium robotaxi (Nuro + Lucid)'
  lead_company_id uuid not null references companies(id),  -- who the row is "about" for sorting/filtering
  summary       text,                       -- one editorial sentence
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table operator_program_roles (
  program_id  uuid not null references operator_programs(id) on delete cascade,
  company_id  uuid not null references companies(id),
  role        text not null
              check (role in ('av_developer', 'vehicle_platform', 'fleet_operator', 'network')),
  primary key (program_id, company_id, role)
);

-- ---------------------------------------------------------------------------
-- competitor_snapshots
-- ---------------------------------------------------------------------------

create table competitor_snapshots (
  id                          uuid primary key default gen_random_uuid(),
  program_id                  uuid not null references operator_programs(id),
  snapshot_date               date not null,
  cities_serving_public       int,
  cities_operating_total      int,          -- includes employee-only and supervised
  vehicle_count               int,
  weekly_rides                int,
  cumulative_rides            numeric,
  autonomous_miles_cumulative numeric,
  funding_total_usd           numeric,
  implied_valuation_usd       numeric,
  supervision                 text
                              check (supervision in
                                ('driverless', 'safety_operator', 'mixed', 'human_is_legal_driver')),
  disclosure_quality          text not null default 'company_disclosed'
                              check (disclosure_quality in
                                ('regulatory', 'company_disclosed', 'earnings_disclosed',
                                 'press_reported', 'estimated')),
  source_id                   uuid references sources(id),
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (program_id, snapshot_date)
);

-- ---------------------------------------------------------------------------
-- cities: optional program linkage (Waymo rows leave it null)
-- ---------------------------------------------------------------------------

alter table cities add column program_id uuid references operator_programs(id);
create index cities_program_id_idx on cities(program_id);

-- ---------------------------------------------------------------------------
-- triggers, RLS
-- ---------------------------------------------------------------------------

create trigger operator_programs_updated_at
  before update on operator_programs
  for each row execute function set_updated_at();

create trigger competitor_snapshots_updated_at
  before update on competitor_snapshots
  for each row execute function set_updated_at();

create trigger audit_operator_programs
  after insert or update or delete on operator_programs
  for each row execute function audit_trigger_fn();

create trigger audit_competitor_snapshots
  after insert or update or delete on competitor_snapshots
  for each row execute function audit_trigger_fn();

-- operator_program_roles has a composite pk (no uuid id), so per the
-- CLAUDE.md audit-trigger limitation it is excluded from audit logging;
-- it is a pure join table with no analytical content of its own.

alter table operator_programs       enable row level security;
alter table operator_program_roles  enable row level security;
alter table competitor_snapshots    enable row level security;

create policy "public select operator_programs"
  on operator_programs for select using (true);
create policy "public select operator_program_roles"
  on operator_program_roles for select using (true);
create policy "public select competitor_snapshots"
  on competitor_snapshots for select using (true);

create policy "admin insert operator_programs" on operator_programs for insert with check (is_admin());
create policy "admin update operator_programs" on operator_programs for update using (is_admin());
create policy "admin delete operator_programs" on operator_programs for delete using (is_admin());

create policy "admin insert operator_program_roles" on operator_program_roles for insert with check (is_admin());
create policy "admin update operator_program_roles" on operator_program_roles for update using (is_admin());
create policy "admin delete operator_program_roles" on operator_program_roles for delete using (is_admin());

create policy "admin insert competitor_snapshots" on competitor_snapshots for insert with check (is_admin());
create policy "admin update competitor_snapshots" on competitor_snapshots for update using (is_admin());
create policy "admin delete competitor_snapshots" on competitor_snapshots for delete using (is_admin());
