-- 0011_ride_estimates_program.sql
-- Module 3.4: ride_estimates rows can now belong to an operator program
-- so CPUC pilot-tier series for non-Waymo carriers (Zoox, Nuro) live
-- alongside Waymo's deployment-tier series. Waymo's existing rows keep
-- program_id NULL and continue to be selected by company_id + city_id IS
-- NULL as before; pilot rows are selected by program_id + tier.

alter table ride_estimates
  add column program_id uuid references operator_programs(id),
  add column tier text check (tier in ('deployment', 'pilot'));

create index ride_estimates_program_id_idx on ride_estimates(program_id);
