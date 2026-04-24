-- 0001_initial_schema.sql
-- Initial schema for The Empty Seat.
-- Uses gen_random_uuid() (Postgres 15 built-in; no extension required).


-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  display_name  text not null,
  founded_year  int,
  parent_company text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table sources (
  id            uuid primary key default gen_random_uuid(),
  url           text not null,
  publisher     text not null,
  title         text not null,
  published_at  timestamptz,
  scraped_at    timestamptz,
  content_hash  text,
  storage_key   text,
  created_at    timestamptz not null default now()
);

create table cities (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id),
  name                text not null,
  metro_area          text,
  country             text not null default 'US',
  launch_date         date,
  public_access_date  date,
  service_area_sq_mi  numeric,
  status              text not null check (status in ('announced', 'waitlist', 'public', 'paused')),
  latitude            numeric,
  longitude           numeric,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table milestones (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id),
  event_date       date not null,
  headline         text not null,
  body             text,
  tags             text[],
  source_id        uuid references sources(id),
  kyle_annotation  text,
  is_published     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table fleet_snapshots (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies(id),
  city_id              uuid references cities(id),
  snapshot_date        date not null,
  vehicle_count        int not null,
  active_vehicle_count int,
  source_id            uuid references sources(id),
  notes                text,
  created_at           timestamptz not null default now()
);

create table ride_estimates (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id),
  city_id           uuid references cities(id),
  period_start      date not null,
  period_end        date not null,
  rides_per_week    int not null,
  avg_fare_usd      numeric,
  source_id         uuid references sources(id),
  confidence        text not null check (confidence in ('high', 'medium', 'low')),
  methodology_note  text,
  created_at        timestamptz not null default now()
);

create table financial_periods (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id),
  fiscal_period       text not null,
  period_start        date not null,
  period_end          date not null,
  revenue_usd         numeric,
  opex_usd            numeric,
  capex_usd           numeric,
  operating_loss_usd  numeric,
  is_disclosed        boolean not null default false,
  source_id           uuid references sources(id),
  methodology_note    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

create trigger cities_updated_at
  before update on cities
  for each row execute function set_updated_at();

create trigger milestones_updated_at
  before update on milestones
  for each row execute function set_updated_at();

create trigger financial_periods_updated_at
  before update on financial_periods
  for each row execute function set_updated_at();


-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------

create or replace function audit_trigger_fn()
returns trigger language plpgsql security definer as $$
begin
  if (TG_OP = 'INSERT') then
    insert into audit_log (user_id, table_name, record_id, action, before, after)
    values (auth.uid(), TG_TABLE_NAME, NEW.id, 'insert', null, to_jsonb(NEW));
    return NEW;
  elsif (TG_OP = 'UPDATE') then
    insert into audit_log (user_id, table_name, record_id, action, before, after)
    values (auth.uid(), TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW));
    return NEW;
  elsif (TG_OP = 'DELETE') then
    insert into audit_log (user_id, table_name, record_id, action, before, after)
    values (auth.uid(), TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD), null);
    return OLD;
  end if;
end;
$$;

create trigger audit_companies
  after insert or update or delete on companies
  for each row execute function audit_trigger_fn();

create trigger audit_sources
  after insert or update or delete on sources
  for each row execute function audit_trigger_fn();

create trigger audit_cities
  after insert or update or delete on cities
  for each row execute function audit_trigger_fn();

create trigger audit_milestones
  after insert or update or delete on milestones
  for each row execute function audit_trigger_fn();

create trigger audit_fleet_snapshots
  after insert or update or delete on fleet_snapshots
  for each row execute function audit_trigger_fn();

create trigger audit_ride_estimates
  after insert or update or delete on ride_estimates
  for each row execute function audit_trigger_fn();

create trigger audit_financial_periods
  after insert or update or delete on financial_periods
  for each row execute function audit_trigger_fn();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table companies         enable row level security;
alter table sources           enable row level security;
alter table cities            enable row level security;
alter table milestones        enable row level security;
alter table fleet_snapshots   enable row level security;
alter table ride_estimates    enable row level security;
alter table financial_periods enable row level security;
alter table audit_log         enable row level security;

-- Helper: returns true when the calling user has is_admin = true in their
-- Supabase app_metadata JWT claim. Set via the Supabase dashboard or service
-- role client: auth.admin.updateUserById(id, { app_metadata: { is_admin: true } })
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  );
$$;

-- Public read (anon + authenticated)
create policy "public select companies"
  on companies for select using (true);

create policy "public select sources"
  on sources for select using (true);

create policy "public select cities"
  on cities for select using (true);

create policy "public select fleet_snapshots"
  on fleet_snapshots for select using (true);

create policy "public select ride_estimates"
  on ride_estimates for select using (true);

create policy "public select financial_periods"
  on financial_periods for select using (true);

-- Milestones: anon sees published only; admin sees all (policies are OR-d)
create policy "public select published milestones"
  on milestones for select using (is_published = true);

create policy "admin select all milestones"
  on milestones for select using (is_admin());

-- Audit log: admin read only
create policy "admin select audit_log"
  on audit_log for select using (is_admin());

-- Admin write: all tables
create policy "admin insert companies"    on companies         for insert with check (is_admin());
create policy "admin update companies"    on companies         for update using (is_admin());
create policy "admin delete companies"    on companies         for delete using (is_admin());

create policy "admin insert sources"      on sources           for insert with check (is_admin());
create policy "admin update sources"      on sources           for update using (is_admin());
create policy "admin delete sources"      on sources           for delete using (is_admin());

create policy "admin insert cities"       on cities            for insert with check (is_admin());
create policy "admin update cities"       on cities            for update using (is_admin());
create policy "admin delete cities"       on cities            for delete using (is_admin());

create policy "admin insert milestones"   on milestones        for insert with check (is_admin());
create policy "admin update milestones"   on milestones        for update using (is_admin());
create policy "admin delete milestones"   on milestones        for delete using (is_admin());

create policy "admin insert fleet_snapshots"
  on fleet_snapshots for insert with check (is_admin());
create policy "admin update fleet_snapshots"
  on fleet_snapshots for update using (is_admin());
create policy "admin delete fleet_snapshots"
  on fleet_snapshots for delete using (is_admin());

create policy "admin insert ride_estimates"
  on ride_estimates for insert with check (is_admin());
create policy "admin update ride_estimates"
  on ride_estimates for update using (is_admin());
create policy "admin delete ride_estimates"
  on ride_estimates for delete using (is_admin());

create policy "admin insert financial_periods"
  on financial_periods for insert with check (is_admin());
create policy "admin update financial_periods"
  on financial_periods for update using (is_admin());
create policy "admin delete financial_periods"
  on financial_periods for delete using (is_admin());

create policy "admin insert audit_log"    on audit_log         for insert with check (is_admin());
