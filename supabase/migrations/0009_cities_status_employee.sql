-- 0009_cities_status_employee.sql
-- Module 2.4: adds 'employee' to the cities status enum for markets where
-- fully driverless operations are running with employee-only riders ahead
-- of public access (the July 2026 cohort: Las Vegas, Denver, San Diego,
-- Tampa). Analytically distinct from 'announced' (paper announcement, no
-- operations) and from 'waitlist' (public riders, gated access).

alter table cities drop constraint if exists cities_status_check;
alter table cities add constraint cities_status_check
  check (status in ('announced', 'waitlist', 'employee', 'public', 'paused'));
