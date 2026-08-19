# schema.md

Per-table detail for The Empty Seat, split out of `architecture.md` on
2026-08-19 when that file hit its 500 line ceiling. Same rule applies
here: what a table means, the convention it encodes, and its gotchas.
Column lists are in `supabase/migrations/` and `lib/supabase/types.ts`,
and are not repeated. Cross-cutting schema notes (RLS model, audit and
updated_at triggers, migration history) stay in `architecture.md`.

Updated in the same commit as any module that changes a table.

---

#### companies
Reference table, 14 rows after 4.2. Alphabet is present as an SEC filer,
not an operator. `hq_country`, `ownership`, `status_summary` from 0010.

#### operator_programs, operator_program_roles (0010)
A program is the unit on the landscape page: the thing on the road. The
roles join is composite pk (program_id, company_id, role) over
'av_developer' | 'vehicle_platform' | 'fleet_operator' | 'network', with
no audit trigger (acceptable for a pure join). Single-company programs
hold all roles; Uber's premium program is Nuro + Lucid + Uber, and Uber
also holds 'network' on Waymo One, Apollo Go, Pony, WeRide, Avride, May
Mobility, Motional. 11 seeded (`scripts/seed-operator-programs.ts`).

#### competitor_snapshots (0010)
Point-in-time readings per program, unique (program_id, snapshot_date).
Every metric column is nullable by design: sparse disclosure is the norm,
not an edge case. `supervision` ('driverless' | 'safety_operator' |
'mixed' | 'human_is_legal_driver') and `disclosure_quality`
('regulatory' | 'company_disclosed' | 'earnings_disclosed' |
'press_reported' | 'estimated') put principle 9 in the schema. 11 rows
seeded 3.2; Apollo Go and Pony need a Q2 refresh after 2026-08-18.

#### sources
Every primary source behind a data point; scrapers and admins both
insert. `content_hash` dedupes scrapes, `storage_key` locates the raw
document in Storage.

#### cities
One row per city per company. `status` (0009): 'announced', 'waitlist',
'employee' (driverless ops, employee riders only), 'public', 'paused'.
Waymo roster 18 rows (9 public, 2 waitlist, 4 employee, 3 announced with
no launch_date, hidden from timeline and map). `name` unique with
company_id (0004). `program_id` (0010) links competitor cities to
programs, 30 seeded 3.2; Waymo rows leave it null and Waymo pages filter
by company_id. `launch_date` is when a market began carrying public
riders, `public_access_date` when the waitlist dropped; the two are
equal only where a market opened without one. `service_area_geojson`
(0005) unused; `external_keys` (0006) per the convention below.

#### milestones
Dated events in Waymo's history; drafts (`is_published = false`) are
admin-only via RLS. `body` is markdown, `tags` is text[].

#### fleet_snapshots
Point-in-time vehicle counts; `city_id` null = company-wide.

#### ride_estimates
Ride volume per company/city; `city_id` null = company-wide (the CPUC
quarterly series). `rides_per_week` is normalized weekly.
`vehicle_miles_traveled` from 0007 (CPUC VMT ZEV); `program_id` and
`tier` ('deployment' | 'pilot') from 0011. Waymo's CPUC deployment
series is company_id waymo with city_id and program_id null; the pilot
series (Zoox, Nuro from Q2 2026) sets program_id and tier 'pilot'.

#### financial_periods
Disclosed or modeled financials by fiscal period; `is_disclosed`
separates filing-sourced from estimated.

#### disclosed_metrics
Point-in-time public disclosures (2.3), unique (company, metric, as_of).
Metric slugs 'weekly_rides', 'cumulative_trips', 'fleet_size',
'cities_count'; `attribution` 'company' | 'investor' | 'media' |
'analyst'. Seeded with Waymo's verified arc (8 weekly_rides including
Tiger Global 450K as 'investor', 4 cumulative_trips, 3 fleet_size), and
the target of metric promotion from the earnings review queue (4.1).

#### earnings_events, waymo_mentions (0012, module 4.1)
`earnings_events` is one row per source document: `company_id` is the
filer (Alphabet), `subject_company_id` the subject (Waymo).
`accession_number` unique for SEC dedupe; `processing_status` 'pending' |
'extracted' | 'reviewed' | 'failed'; extraction usage columns and
`mentions_dropped` from 0013. `waymo_mentions` is one row per quote:
`mention_type` (11 values), `extracted_metric` jsonb, `review_status`
'pending' | 'approved' | 'rejected', `page_or_timestamp` holding the
extraction passage id (resolvable in the source viewer), and
`disclosed_metric_id` set when approval promotes a metric. RLS: anon
sees events and APPROVED mentions only. The v1 extracted_metrics table
is dropped; disclosed_metrics is the metrics store.

#### site_content
Key/value store for admin-editable editorial copy, `key` is a text pk.
No audit trigger (text pk; see CLAUDE.md audit trigger limitation).

#### audit_log
Append-only, written by `audit_trigger_fn()`, admin-read only via RLS.
`record_id` is UUID, so the trigger fires only on UUID-pk tables.

