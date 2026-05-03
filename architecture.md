# architecture.md

Living state of the codebase. Refreshed at the end of every module that
changes any of: schema, routes, components, conventions, integrations,
or debt. Read this at the start of every planning conversation and
before any orientation report.

This file is not the plan (see dev-plan.md) and not the working
agreement (see CLAUDE.md). It is the answer to "what currently exists
and what's known about it."

Hard rule: keep this file under 500 lines. Consolidate when it grows past that.

---

## Last updated

Module: 1.6
Date: 2026-05-02
Commit: 1.6 work

---

## Schema

### Tables

#### companies
Reference table. Six rows seeded: Waymo plus five competitors. Columns:
`id` (pk), `slug` (unique), `display_name`, `founded_year` (nullable),
`parent_company` (nullable), `created_at`, `updated_at`. Public frontend
is Waymo-only; competitor rows exist for future comparative data.

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
Point-in-time vehicle counts per company/city. `city_id` nullable for
company-wide snapshots. Columns: `id` (pk), `company_id`, `city_id`
(nullable, fk cities), `snapshot_date`, `vehicle_count`,
`active_vehicle_count` (nullable), `source_id` (nullable), `notes`
(nullable), `created_at`.

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
Append-only log written by `audit_trigger_fn()`. Admin-read only via
RLS. `record_id` is UUID; trigger only fires on tables with UUID `id`
columns. Columns: `id` (pk), `user_id` (nullable), `table_name`,
`record_id`, `action` ('insert'/'update'/'delete'), `before` (jsonb,
nullable), `after` (jsonb, nullable), `created_at`.

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
- **Disclosed metrics convention:** most-recent company-wide disclosures
  live in `site_content` under keys prefixed `latest_*_disclosed`. The
  `markdown_body` stores YAML-style text: `value`, `as_of` (YYYY-MM-DD),
  `source_id` (UUID referencing `sources`). `lib/disclosed-metrics.ts`
  parses and joins. Hero and KeyStats prefer disclosed values over CPUC
  aggregates and fall back gracefully if absent or malformed.
- **external_keys convention:** cities.external_keys is a jsonb map from
  source slug to that source's city identifier. Keys: `"robotaxi_tracker"`,
  `"nhtsa"`, etc. Populated lazily; scrapers write their key when first run.
  All 11 Waymo cities ship with empty `{}`.
- **Migration history:** 0001 initial; 0002 site_content; 0003 drop
  site_content trigger; 0004 cities unique (company_id, name); 0005
  service_area_geojson; 0006 external_keys + GIN; 0007 VMT field.

---

## Routes

### Public routes

| path | renders | data sources | revalidation |
|------|---------|--------------|--------------|
| / | ThesisHero, Thesis, KeyStats, Operations, RecentMilestones | ride_estimates, site_content, cities, milestones | ISR 3600s; on-demand from admin mutations |
| /milestones | MilestoneCard listing, tag filter chips | milestones | ISR 3600s |
| /milestones/[id] | full detail, source link, annotation | milestones, sources | ISR 3600s; 404 for drafts |
| /methodology | MarkdownBody render of methodology_body from site_content; falls back to PLACEHOLDER const if key absent | site_content | ISR 3600s; on-demand when site_content admin saves |
| /methodology/sources | Auto-generated source list grouped by publisher, sorted published_at DESC | sources | ISR 3600s; on-demand when sources admin mutates |

All other public routes (unit-economics, financials, earnings, landscape,
safety, outlook) are planned but not yet built.

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
| /admin/milestones | list, publish toggle | update is_published | /admin/milestones, /milestones, / |
| /admin/milestones/new | create | insert | /milestones, / |
| /admin/milestones/[id] | edit, delete | update, delete | /milestones, / |
| /admin/site-content | list + create new key form | insert | /admin/site-content/[key] |
| /admin/site-content/[key] | edit | upsert | / |
| /admin/companies, sources, fleet-snapshots, ride-estimates, financial-periods | full CRUD | insert, update, delete | none currently |
| /api/cron/scraper-health | daily health check cron | none | n/a |
| /auth/callback | Supabase auth callback | n/a | n/a |

Note: fleet-snapshots/ride-estimates/financial-periods mutations do not
call revalidatePath. Sources revalidates /methodology/sources; site-content
revalidates /methodology and /methodology/sources.

---

## Components

### components/sections/

- **PageShell:** async server component; sticky nav and footer. Calls
  `getGlobalLastUpdated()` and renders "Last updated: Month D, YYYY" in
  footer. Methodology is in desktop nav with `opacity-70` (meta-link).
  `scroll-behavior: smooth` handles scroll animation globally.
- **ThesisHero:** full-viewport hero with animated ride count. Prefers
  `getLatestDisclosedWeeklyRides()` over CPUC; caption reads "WEEKLY RIDES,
  AS OF [date]" or "ESTIMATED WEEKLY RIDES" accordingly. Pending state
  (large serif paragraph) when both null. Counter animation via Framer Motion
  in ThesisHeroCounter (client).
- **Thesis:** fetches `thesis_paragraphs` from `site_content` via
  `getSiteContent`, renders markdown. Returns null if key absent.
- **KeyStats:** 4-tile band (weekly rides, cities served, cumulative
  trips 2025 CA, miles driven 2025 CA). Tile 1 prefers disclosed
  worldwide value from `getLatestDisclosedWeeklyRides()`; falls back to
  CPUC. Label is "WEEKLY RIDES" when disclosed, "AVG WEEKLY RIDES (CA)"
  on fallback. Tooltip on tile 1 cites Waymo source and notes worldwide
  scope when disclosed. Tiles 3/4 always from CPUC. Tile 2 from cities
  count. All metric tiles use `<Metric>` with source link and as-of
  annotation. Shows `--` with pending note when no data available.
- **Operations:** server component. Fetches Waymo cities and CPUC
  quarterly chart data. Composes CityLaunchTimeline, QuarterlyTripsChart,
  CoverageMapClient, and methodology footnote.
- **RecentMilestones:** server component. Fetches 5 most recent published
  milestones. Renders MilestoneCard list with "View all" link. Returns
  null if no published milestones. Section id="milestones".

### components/ui/

- **Container, Prose, Heading, Button, Card:** design system primitives.
- **Tooltip:** Radix UI wrapper, 8s auto-dismiss, mobile tap-to-reveal.
- **Metric:** numeric value with info icon; tooltip shows explanation,
  source, as-of date.
- **Term:** dotted underline; tooltip shows glossary entry by key.
- **MarkdownBody:** react-markdown + remark-gfm + rehype-raw. Full
  markdown support (headings, lists, tables, blockquotes, code). HTML
  comments pass through as real HTML comments (invisible to readers).
  Admin-authored content only; rehype-raw is safe in this context.

### components/milestones/

- **MilestoneCard:** shared card component for listing and landing page.
  Shows date, tag chips (using `tagLabel`), headline, body preview
  (line-clamp-3), and annotation. `linked` prop wraps in Next.js Link;
  false for non-linked uses.

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

- **lib/last-updated.ts:** `getGlobalLastUpdated()`: max timestamp across
  8 data tables (excludes audit_log). Used by PageShell footer.
- **lib/milestones/tags.ts:** `MILESTONE_TAGS` const array (8 slugs),
  `MilestoneTag` type, `tagLabel(tag)` display-label function. Single
  source of truth for tag vocabulary; imported by admin pages and public
  pages alike. Current tags: new_city, technology, operations,
  partnership, international, safety, financial, scale_metrics.
- **lib/cohorts.ts:** `getCohortBucket(launchDate)` returns bucket
  index (1-5), label, and hex color. `getBucketLegend(dates)` returns
  sorted distinct buckets for legend rendering. Used by CoverageMap;
  chart use removed in 1.3 (QuarterlyTripsChart uses accent color only).
- **lib/glossary/index.ts:** central glossary, 18 terms. Keys include:
  disengagement_rate, contribution_margin, autonomous_miles, remote_assist,
  safety_driver, service_area, cpuc, weekly_rides, vehicles_in_fleet,
  cohort, rides_per_vehicle_per_day, waitlist_city, and others.
  `GlossaryKey` type is auto-derived.
- **lib/scrapers/cpuc.ts:** `runCpucScrape()` fetches CPUC quarterly data
  from Robotaxi Tracker's JSON mirror; inserts/updates ride_estimates rows
  (city_id = NULL, confidence = 'high'). Trips and VMT ZEV only; incident_metrics deferred.
- **lib/disclosed-metrics.ts:** `getLatestDisclosedWeeklyRides()` reads
  the `latest_weekly_rides_disclosed` site_content row, parses the
  YAML-style `markdown_body` (fields: `value`, `as_of`, `source_id`),
  joins to the `sources` table, and returns structured data. Returns null
  with a console warning if the row is absent, malformed, or references a
  missing source. Called by ThesisHero and KeyStats.
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
| Supabase | live | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | linked project, RLS enabled; Site URL = prod Vercel URL, Redirect URLs include localhost wildcard for dev magic links; local dev currently needs email host swap, fix via `emailRedirectTo` deferred |
| Mapbox | live | NEXT_PUBLIC_MAPBOX_TOKEN | CoverageMap (1.2.c) |
| Slack | live (prod) | SLACK_WEBHOOK_URL | production channel in Vercel; dev URL retained in .env.local |
| Anthropic API | not yet wired | ANTHROPIC_API_KEY | reserved for Phase 4 extraction |
| Vercel Cron | live | CRON_SECRET | scraper-health daily; rotated in 1.6 |
| GitHub Actions | live | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRAPER_USER_AGENT, SLACK_WEBHOOK_URL | .github/workflows/scrape-cpuc.yml, weekly Monday 13:17 UTC |

---

## Conventions adopted

- **Pending-state pattern:** section + Container always rendered; pending
  branch is serif paragraph at `text-[2.25rem] sm:text-[3rem]`. No Card.
- **Cohort coloring:** `getCohortBucket(launchDate)`. Used by CoverageMap.
- **Revalidation:** server actions call `revalidatePath`. DB-level ISR
  triggers deferred.
- **Smooth scroll:** `scroll-behavior: smooth`; sections use `scroll-mt-20`.
- **Lazy-loading:** `next/dynamic` with `ssr: false`. See CoverageMapClient.
- **Admin mutations:** `supabaseAdmin` (service-role); server actions in page files.
- **Em dashes:** forbidden everywhere. Commit prefix: `feat(N.N)`.
- **external_keys:** scrapers write city identifiers under their source slug;
  ships as `{}`, populated lazily.
- **Confidence levels:** disclosed-source scrapers use `'high'`; community
  or estimated sources use `'medium'` or `'low'`.
- **Methodology copy:** factual sections seeded by Claude Code; editorial
  framing and changelog are user-authored. `<!-- TODO -->` HTML comments
  mark user-authored sections (invisible to readers). Content in
  `site_content` keyed `methodology_body`.
- **Public route layout (canonical pattern):** `app/(public)/layout.tsx`
  wraps every `(public)` route in PageShell. New public pages go inside
  `(public)` and render content only. Homepage at root is the exception:
  outside `(public)`, calls PageShell directly. Root cause of the 1.4
  milestones nav/footer bug: this layout was missing.
- **Admin server action error pattern:** capture `{ error }` from Supabase
  mutations; on error, throw `Failed to <verb> <table> row: ${error.message}`
  before `revalidatePath`/`redirect`. Applied uniformly across all admin actions.
- **Discoverability gate:** `SITE_PUBLIC=true` lifts the noindex gate; default unset.
  `proxy.ts` adds `X-Robots-Tag: noindex, nofollow, noarchive` to every public response (skipping /admin, /auth, /api); root `generateMetadata` emits the matching `<meta>`.

---

## Known gaps and debt

**Pre-launch:** see `pre-launch.md` at repo root.

**Structural debt:**
- **Magic-link verification pending:** admin click-through against prod was deferred from 1.6 due to Supabase email rate limit; provisional based on Site URL fix.
- **Broken delete confirm on companies/[id]:** `onSubmit={() => confirm(...) ||
  event?.preventDefault()}` on a server-component form. `event` is undefined and
  server forms do not register client handlers; confirm dialog never fires.
- **site_content YAML textarea:** free-form text; collapsing the multi-line
  format to one line causes silent parser failure. Pre-fill with template
  content rather than placeholder text. Deferred.
- Disclosed weekly rides (`latest_weekly_rides_disclosed`) is a manual
  site_content entry; must be updated when Waymo makes new disclosures.
  If episodic disclosures become more frequent, consider promoting to a
  dedicated `disclosed_metrics` table. The `latest_*_disclosed` key
  prefix is the agreed convention for future additions.
- fleet-snapshots, ride-estimates, financial-periods mutations do not revalidatePath.
- `audit_trigger_fn` hard-coded to `NEW.id`; non-UUID PK tables excluded (CLAUDE.md).
- `is_published` DB-level ISR trigger not wired; admin mutation revalidation covers it.
- City detail pages not built; timeline shows disabled links.
- `service_area_geojson` exists but unused; polygon rendering deferred.
- All public routes except /, /milestones*, /methodology* are stubs.
- Quantitative metrics are California-only; no per-quarter data for other states.
- QuarterlyTripsChart has Q1-Q4 2025 only; pre-2025 CPUC baseline deferred to Phase 4.
- CPUC incident_metrics and monthly_trends not ingested; Phase 6 territory.
- lib/supabase/types.ts manually patched for 0006, 0007; regenerate after migrations.

---

## Parking lot

- State-level fill on coverage map (US states colored by Waymo stage). Deferred 1.2.c.
- Robotaxi Tracker as corroborating signal alongside CPUC data. Phase 5 territory.
- Pre-2025 CPUC baseline via cpuc.ca.gov extraction. Phase 4 (overlaps SEC EDGAR).

---

## Appendix: file structure quick map

```
app/
  page.tsx                     landing page composition
  layout.tsx                   root layout, TooltipProvider, fonts
  globals.css                  @theme tokens, scroll-behavior, cohort colors
  (public)/
    layout.tsx                 wraps children in PageShell (nav + footer)
    milestones/
      page.tsx                 listing with tag filter chips
      [id]/page.tsx            detail page, 404 for drafts
    methodology/
      page.tsx                 MarkdownBody render of methodology_body
      sources/page.tsx         auto-generated source list grouped by publisher
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
    RecentMilestones.tsx
  ui/                          Button, Card, Container, Heading, Prose,
                               Tooltip, Metric, Term, MarkdownBody
  operations/                  CityLaunchTimeline, QuarterlyTripsChart,
                               CoverageMap, CoverageMapClient
  milestones/                  MilestoneCard

lib/
  cohorts.ts
  disclosed-metrics.ts
  site-content.ts
  glossary/index.ts
  milestones/
    tags.ts
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
  seed-recent-waymo-milestones.ts  6 seed milestones (one-time, idempotent)
  seed-methodology-content.ts  upserts methodology_body into site_content
  update-methodology-disclosed-source.ts  prepends two-tier sourcing para to methodology_body
  fix-disclosed-row-formatting.ts         one-time fix for malformed latest_weekly_rides_disclosed row
  update-methodology-todos.ts             one-time replacement of methodology_body TODO blocks and contact email

.github/
  workflows/
    scrape-cpuc.yml            weekly Monday 13:17 UTC, workflow_dispatch
```
