# architecture.md

Living state of the codebase. Refreshed at the end of every module that
changes any of: schema, routes, components, conventions, integrations,
or debt. Read this at the start of every planning conversation and
before any orientation report.

This file is not the plan (see dev-plan.md) and not the working
agreement (see CLAUDE.md). It is the answer to "what currently exists
and what's known about it."

Hard rule: keep this file under 500 lines. When it grows past that,
consolidate or move historical content to an appendix file.

---

## Last updated

Module: 1.3
Date: 2026-04-28
Commit: 1.3 work

---

## Schema

### Tables

#### companies
Reference table for AV companies. Six rows seeded (Waymo plus five
competitors). The public frontend is Waymo-only; competitor rows exist
for future comparative data.

| column | type | notes |
|--------|------|-------|
| id | uuid | pk |
| slug | text | unique, e.g. 'waymo' |
| display_name | text | |
| founded_year | int | nullable |
| parent_company | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### sources
Tracks every primary source linked to a data point. Scrapers insert
rows here; human-entered data can also reference a source.

| column | type | notes |
|--------|------|-------|
| id | uuid | pk |
| url | text | |
| publisher | text | |
| title | text | |
| published_at | timestamptz | nullable |
| scraped_at | timestamptz | nullable |
| content_hash | text | nullable, used for scraper dedupe |
| storage_key | text | nullable, raw doc in Supabase Storage |
| created_at | timestamptz | |

#### cities
One row per city per company. Holds all operational and geographic data
for a market. `status` is an enum: 'announced', 'waitlist', 'public',
'paused'. `service_area_geojson` is reserved; the map currently derives
circles from `service_area_sq_mi` only. `external_keys` is populated
lazily by scrapers as they come online (empty `{}` by default).

| column | type | notes |
|--------|------|-------|
| id | uuid | pk |
| company_id | uuid | fk companies |
| name | text | unique with company_id (constraint 0004) |
| metro_area | text | nullable |
| country | text | default 'US' |
| launch_date | date | nullable |
| public_access_date | date | nullable |
| service_area_sq_mi | numeric | nullable |
| status | text | check constraint |
| latitude | numeric | nullable |
| longitude | numeric | nullable |
| notes | text | nullable |
| service_area_geojson | jsonb | nullable, added 0005, unused by map |
| external_keys | jsonb | NOT NULL default '{}', added 0006 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### milestones
Dated events in Waymo's history. Drafts (`is_published = false`) are
admin-only. Public RLS policy filters to published rows only.

| column | type | notes |
|--------|------|-------|
| id | uuid | pk |
| company_id | uuid | fk companies |
| event_date | date | |
| headline | text | |
| body | text | nullable, markdown |
| tags | text[] | nullable |
| source_id | uuid | nullable, fk sources |
| kyle_annotation | text | nullable |
| is_published | boolean | default false |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### fleet_snapshots
Point-in-time vehicle counts per company/city. `city_id` is nullable
for company-wide snapshots.

| column | type | notes |
|--------|------|-------|
| id | uuid | pk |
| company_id | uuid | fk companies |
| city_id | uuid | nullable, fk cities |
| snapshot_date | date | |
| vehicle_count | int | |
| active_vehicle_count | int | nullable |
| source_id | uuid | nullable, fk sources |
| notes | text | nullable |
| created_at | timestamptz | |

#### ride_estimates
Weekly ride volume estimates per company/city. `city_id` null means
company-wide. `confidence` is an enum: 'high', 'medium', 'low'.
`vehicle_miles_traveled` is populated by CPUC scraper (quarterly VMT ZEV).

| column | type | notes |
|--------|------|-------|
| id | uuid | pk |
| company_id | uuid | fk companies |
| city_id | uuid | nullable, fk cities |
| period_start | date | |
| period_end | date | |
| rides_per_week | int | normalized to weekly |
| avg_fare_usd | numeric | nullable |
| source_id | uuid | nullable, fk sources |
| confidence | text | check constraint |
| methodology_note | text | nullable |
| vehicle_miles_traveled | numeric | nullable, added 0007, VMT ZEV from CPUC |
| created_at | timestamptz | |

#### financial_periods
Disclosed or modeled financial data by fiscal period. `is_disclosed`
distinguishes filing-sourced data from estimates.

| column | type | notes |
|--------|------|-------|
| id | uuid | pk |
| company_id | uuid | fk companies |
| fiscal_period | text | e.g. 'Q1 2026' |
| period_start | date | |
| period_end | date | |
| revenue_usd | numeric | nullable |
| opex_usd | numeric | nullable |
| capex_usd | numeric | nullable |
| operating_loss_usd | numeric | nullable |
| is_disclosed | boolean | |
| source_id | uuid | nullable, fk sources |
| methodology_note | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### site_content
Key/value store for admin-editable editorial copy. Uses `key text` as
primary key (not UUID); audit trigger is omitted for this reason (see
CLAUDE.md audit trigger limitation note). `updated_at` tracks changes.

| column | type | notes |
|--------|------|-------|
| key | text | pk, e.g. 'thesis_paragraphs' |
| markdown_body | text | |
| updated_at | timestamptz | |

#### audit_log
Append-only log written by `audit_trigger_fn()` on every mutating
operation. Admin-read only via RLS. `record_id` is UUID, so the
trigger only fires on tables with UUID `id` columns.

| column | type | notes |
|--------|------|-------|
| id | uuid | pk |
| user_id | uuid | nullable |
| table_name | text | |
| record_id | uuid | |
| action | text | 'insert', 'update', 'delete' |
| before | jsonb | nullable |
| after | jsonb | nullable |
| created_at | timestamptz | |

### Cross-cutting schema notes

- **RLS model:** public SELECT open on all tables except `milestones`
  (published only for anon) and `audit_log` (admin only). All writes
  require an authenticated user passing `is_admin()`.
- **is_admin():** SQL function in `0001`. Reads
  `app_metadata.is_admin` from the Supabase JWT. Set via service-role
  client or dashboard.
- **Audit triggers:** `audit_trigger_fn()` fires on companies, sources,
  cities, milestones, fleet_snapshots, ride_estimates, financial_periods.
  Not on `site_content` (text PK, not UUID) or `audit_log` itself.
- **updated_at triggers:** companies, cities, milestones,
  financial_periods, site_content.
- **external_keys convention:** cities.external_keys is a jsonb map from
  source slug to that source's city identifier. Keys: `"robotaxi_tracker"`,
  `"nhtsa"`, etc. Populated lazily; scrapers write their key when first run.
  All 11 Waymo cities ship with empty `{}`.
- **Migration history:** 0001 initial schema; 0002 site_content table;
  0003 drop site_content audit trigger; 0004 cities unique constraint
  (company_id, name); 0005 cities.service_area_geojson jsonb column;
  0006 cities.external_keys jsonb + GIN index; 0007 ride_estimates.vehicle_miles_traveled.

---

## Routes

### Public routes

| path | renders | data sources | revalidation |
|------|---------|--------------|--------------|
| / | ThesisHero, Thesis, KeyStats, Operations | ride_estimates, site_content, cities | ISR 3600s; on-demand from cities/fleet/ride admin mutations |

All other public routes (milestones, methodology, unit-economics,
financials, earnings, landscape, safety, outlook) are planned but not
yet built.

### Admin routes

Outer `app/admin/layout.tsx` is a passthrough with no auth check
(keeps `/admin/login` public). Auth gate lives in
`app/admin/(protected)/layout.tsx` which checks session and redirects
to `/admin/login` if absent. All mutations use `supabaseAdmin`
(service-role, bypasses RLS).

| path | purpose | mutations | revalidates |
|------|---------|-----------|-------------|
| /admin/login | magic link auth | n/a | n/a |
| /admin | dashboard, row counts | none | n/a |
| /admin/cities | list | none | n/a |
| /admin/cities/new | create | insert | / |
| /admin/cities/[id] | edit, delete | update, delete | / |
| /admin/milestones | list, publish toggle | update is_published | /admin/milestones |
| /admin/milestones/new | create | insert | n/a |
| /admin/milestones/[id] | edit, delete | update, delete | n/a |
| /admin/site-content | list | none | n/a |
| /admin/site-content/[key] | edit | upsert | / |
| /admin/companies, sources, fleet-snapshots, ride-estimates, financial-periods | full CRUD | insert, update, delete | none currently |
| /api/cron/scraper-health | daily health check cron | none | n/a |
| /auth/callback | Supabase auth callback | n/a | n/a |

Note: fleet-snapshots, ride-estimates, and financial-periods admin
mutations do not yet call `revalidatePath`. Not a problem until
those tables drive public pages.

---

## Components

### components/sections/

- **PageShell:** site-wide sticky nav and footer. Nav uses plain `<a>`
  tags for in-page anchors (/#operations etc.) and Next.js Link for
  routes. `scroll-behavior: smooth` handles scroll animation globally.
- **ThesisHero:** full-viewport hero with animated ride count. Pending
  state (large serif paragraph) when `ride_estimates` is empty.
  Counter animation via Framer Motion in ThesisHeroCounter (client).
- **Thesis:** fetches `thesis_paragraphs` from `site_content` via
  `getSiteContent`, renders markdown. Returns null if key absent.
- **KeyStats:** 4-tile band (avg weekly rides CA, cities served,
  cumulative trips 2025 CA, miles driven 2025 CA). Tiles 1/3/4 sourced
  from CPUC ride_estimates rows (city_id = NULL). Tile 2 from cities
  count. All metric tiles use `<Metric>` with CPUC source link and
  as-of annotation. Shows `--` with pending note when no CPUC data.
- **Operations:** server component. Fetches Waymo cities and CPUC
  quarterly chart data. Composes CityLaunchTimeline, QuarterlyTripsChart,
  CoverageMapClient, and methodology footnote.

### components/ui/

- **Container, Prose, Heading, Button, Card:** design system primitives.
- **Tooltip:** Radix UI wrapper, 8s auto-dismiss, mobile tap-to-reveal.
- **Metric:** numeric value with info icon; tooltip shows explanation,
  source, as-of date.
- **Term:** dotted underline; tooltip shows glossary entry by key.

### components/operations/

- **CityLaunchTimeline (client):** vertical accordion, all 11 cities
  sorted by launch_date. One panel open at a time via local state.
  Framer Motion height animation with `AnimatePresence initial={false}`.
- **QuarterlyTripsChart (client):** Recharts LineChart, X-axis quarterly
  labels, Y-axis trips (formatted as M). Four data points (Q1-Q4 2025).
  QoQ growth rate in custom tooltip. Editorial framing paragraph above
  chart with Robotaxi Tracker outbound link. Pending state (serif
  paragraph) when data array is empty. As-of footnote with `<Term
  term="cpuc">` below chart.
- **CoverageMap (client):** Mapbox GL JS, lazy-loaded via
  CoverageMapClient wrapper (ssr: false). GeoJSON polygon circles for
  cities with sq_mi; fixed 8px pins for cities without. Waitlist
  styling: dashed outline, reduced fill opacity. Hover popups via
  Mapbox Popup. Style overrides on load to match editorial palette.
- **CoverageMapClient:** `"use client"` dynamic import wrapper. Renders
  a pulsing skeleton while Mapbox loads.

---

## Libraries and integrations

### lib/

- **lib/cohorts.ts:** `getCohortBucket(launchDate)` returns bucket
  index (1-5), label, and hex color. `getBucketLegend(dates)` returns
  sorted distinct buckets for legend rendering. Used by CoverageMap;
  chart use removed in 1.3 (QuarterlyTripsChart uses accent color only).
- **lib/glossary/index.ts:** central glossary, 18 terms. Added: `cpuc`.
  Current keys: disengagement_rate, contribution_margin, autonomous_miles,
  rider_only_miles, remote_assist, safety_driver, service_area, odd,
  waymo_driver_gen6, other_bets, capex_intensity, unit_economics,
  cpuc, weekly_rides, vehicles_in_fleet, cohort,
  rides_per_vehicle_per_day, waitlist_city. `GlossaryKey` type is
  auto-derived.
- **lib/scrapers/cpuc.ts:** `runCpucScrape()` fetches CPUC quarterly
  data from Robotaxi Tracker's hosted JSON mirror, inserts/updates
  ride_estimates rows (city_id = NULL, confidence = 'high'). Scoped to
  trips and VMT ZEV only; incident_metrics and monthly_trends are present
  in the source file but not consumed. Tries years [2025, 2026]; 404s
  are skipped gracefully. Dedup by comparing stored rides_per_week and
  vehicle_miles_traveled. Creates its own Supabase client (no
  server-only dependency; safe for tsx scripts and GitHub Actions).
- **lib/site-content.ts:** `getSiteContent(key)` server helper.
- **lib/notify.ts:** `notifySlack(message, level)` POSTs to Slack webhook.
- **lib/supabase/server.ts:** session-bound client for RLS reads.
- **lib/supabase/admin.ts:** service-role client, server-only.
- **lib/supabase/browser.ts:** anon client for client components.
- **lib/supabase/types.ts:** generated types, manually patched for
  migrations 0006 (cities.external_keys) and 0007
  (ride_estimates.vehicle_miles_traveled). Regenerate with
  `supabase gen types typescript` after any future migration.

### External integrations

| service | status | env vars | notes |
|---------|--------|---------|-------|
| Supabase | live | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | linked project, RLS enabled |
| Mapbox | live | NEXT_PUBLIC_MAPBOX_TOKEN | CoverageMap (1.2.c) |
| Slack | dev channel | SLACK_WEBHOOK_URL | production channel pending before 1.6 |
| Anthropic API | not yet wired | ANTHROPIC_API_KEY | reserved for Phase 4 extraction |
| Vercel Cron | live | CRON_SECRET | scraper-health daily; rotation pending before 1.6 |
| GitHub Actions | live | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRAPER_USER_AGENT, SLACK_WEBHOOK_URL | .github/workflows/scrape-cpuc.yml, weekly Monday 13:17 UTC |

---

## Conventions adopted

- **Pending-state pattern:** section + Container always rendered,
  ternary inside, pending branch is a serif paragraph at
  `text-[2.25rem] sm:text-[3rem] leading-tight` with a TODO comment.
  No Card frame. Established 1.1, mirrored in 1.2.b and 1.2.d.
- **Cohort coloring:** `getCohortBucket(launchDate)` from lib/cohorts.ts.
  Single-hue ramp, `--color-cohort-1` through `--color-cohort-5`.
  Used by CoverageMap; not used by QuarterlyTripsChart (accent only).
- **Revalidation:** server actions call `revalidatePath('/')` after
  mutations. DB-level triggers for ISR revalidation are deferred.
- **Smooth scroll:** `scroll-behavior: smooth` on `html` in globals.css.
  Anchored sections use `scroll-mt-20` to clear sticky nav.
- **Lazy-loading client-heavy components:** `next/dynamic` with
  `ssr: false` in a `"use client"` wrapper file. See CoverageMapClient.
- **Admin mutations:** always use `supabaseAdmin` (service-role).
  Server actions in page files, not separate route handlers.
- **Em dashes:** forbidden everywhere. Commit prefix: `feat(N.N):` or
  `fix(N.N):`.
- **external_keys pattern:** scrapers write their city identifier into
  `cities.external_keys` under their source slug. Column ships as `{}`
  for all cities; populated lazily when the scraper first runs.
- **Disclosed-source scrapers:** write to data tables with
  `confidence='high'`. Community-tracked or estimated sources use
  `confidence='medium'` or `'low'`.

---

## Known gaps and debt

- fleet-snapshots, ride-estimates, and financial-periods admin mutations
  do not call `revalidatePath`; harmless until those tables drive public
  pages.
- `audit_trigger_fn` hard-coded to `NEW.id`; non-UUID PK tables cannot
  use it. Options documented in CLAUDE.md.
- CRON_SECRET rotation deferred until before 1.6 production deploy.
- Dedicated production Slack channel deferred until before 1.6.
- `is_published` trigger for ISR revalidation not yet wired; needed
  when milestones and other published content drive public pages.
- City detail pages (`/cities/[slug]`) referenced in timeline accordion
  as disabled links; not yet built.
- `service_area_geojson` column exists but the map does not consume it;
  polygon rendering is deferred. TODO comment in CoverageMap.tsx marks
  the insertion point.
- All public routes except `/` are stubs (not yet built).
- Quantitative metrics (KeyStats tiles, QuarterlyTripsChart) are
  California-only because CPUC is the only state regulator publishing
  per-quarter Waymo data we have access to. Other states do not publish
  equivalent data.
- QuarterlyTripsChart is sparse (4 data points: Q1-Q4 2025) until
  pre-2025 CPUC data is sourced via direct cpuc.ca.gov extraction.
  Deferred to Phase 4 (patterns overlap with SEC EDGAR pipeline).
- CPUC source file contains incident_metrics (collisions, complaints,
  injuries per 100K trips) and monthly_trends. Neither is ingested in
  1.3. Phase 6 (Safety Dashboard) should consume incident_metrics.
  monthly_trends ingestion deferred until a chart needs that resolution.
- Robotaxi Tracker is referenced in the methodology footnote as an
  external resource for live community-tracked data; it is not a backend
  source. Decision and rationale documented in commit history.
- lib/supabase/types.ts was manually patched for migrations 0006 and
  0007 rather than regenerated; run `supabase gen types typescript` to
  sync after any future migration.

---

## Parking lot

- State-level fill on coverage map (color US states by Waymo presence
  stage). Raised during 1.2.c scoping, deferred.
- Robotaxi Tracker as comparative sidebar source. Community sightings
  could appear as a corroborating signal alongside disclosed CPUC data,
  but only after disclosed data is solid. Phase 5 territory if at all.
- Pre-2025 CPUC baseline via direct cpuc.ca.gov filing extraction.
  Phase 4 territory (overlaps with SEC EDGAR pipeline build).

---

## Appendix: file structure quick map

```
app/
  page.tsx                     landing page composition
  layout.tsx                   root layout, TooltipProvider, fonts
  globals.css                  @theme tokens, scroll-behavior, cohort colors
  admin/
    layout.tsx                 passthrough, no auth check
    login/                     magic link page
    (protected)/
      layout.tsx               session auth gate
      cities/                  CRUD (list, new, [id])
      companies/               CRUD
      milestones/              CRUD + publish toggle
      sources/                 CRUD
      fleet-snapshots/         CRUD
      ride-estimates/          CRUD
      financial-periods/       CRUD
      site-content/            list + [key] edit
  api/
    cron/scraper-health/       daily health check

components/
  sections/
    PageShell.tsx
    ThesisHero.tsx + ThesisHeroCounter.tsx
    Thesis.tsx
    KeyStats.tsx
    Operations.tsx
  ui/                          Button, Card, Container, Heading, Prose,
                               Tooltip, Metric, Term
  operations/                  CityLaunchTimeline, QuarterlyTripsChart,
                               CoverageMap, CoverageMapClient

lib/
  cohorts.ts
  site-content.ts
  glossary/index.ts
  notify.ts
  scrapers/
    cpuc.ts
  supabase/                    server.ts, admin.ts, browser.ts, types.ts

supabase/
  migrations/                  0001 through 0007
  seed.sql                     6 company rows only

scripts/
  seed-cities.ts               one-time city seed (11 Waymo cities)
  run-scraper-cpuc.ts          CPUC quarterly scraper entry point

.github/
  workflows/
    scrape-cpuc.yml            weekly Monday 13:17 UTC, workflow_dispatch
```
