-- Interlude between modules 1.1 and 1.2: add unique constraint on cities(company_id, name)
-- Required for idempotent upsert in scripts/seed-cities.ts.

alter table public.cities
  add constraint cities_company_id_name_key unique (company_id, name);
