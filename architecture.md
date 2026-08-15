# architecture.md

Living state of the codebase, refreshed at the end of every module that
changes schema, routes, components, conventions, integrations, or debt.
Read this at the start of every planning conversation. Not the plan
(dev-plan.md), not the working agreement (CLAUDE.md): it answers "what
currently exists." Hard rule: under 500 lines; consolidate past that.

---

## Last updated

Module: 2.4
Date: 2026-08-15
Commit: 2.4 work

---

## Schema

### Tables

#### companies
Reference table. Six rows seeded: Waymo plus five competitors. Columns:
`id` (pk), `slug` (unique), `display_name`, `founded_year` (nullable),
`parent_company` (nullable), `created_at`, `updated_at`. Public frontend
is Waymo-only; competitor rows exist for future comparative data.

#### sources
Every primary source linked to a data point; scrapers and admins both
insert. Columns: `id` (pk), `url`, `publisher`, `title`, `published_at`
(nullable), `scraped_at` (nullable), `content_hash` (nullable, scraper
dedupe), `storage_key` (nullable, raw doc in Storage), `created_at`.

#### cities
One row per city per company. Holds all operational and geographic data
for a market. `status` check (0009): 'announced', 'waitlist', 'employee',
'public', 'paused'. 'employee' = fully driverless operations with
employee-only riders ahead of public access. As of 2.4 the Waymo roster
is 18 rows: 8 public, 2 waitlist, 4 employee, 3 announced (no launch
date, so hidden from timeline/map), plus Bay Area naming note.
`service_area_geojson` is reserved; the map derives circles from
`service_area_sq_mi` only. `external_keys` is populated lazily by
scrapers (empty `{}` by default).

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
Dated events in Waymo's history; drafts (`is_published = false`) are
admin-only via RLS. Columns: `id` (pk), `company_id` (fk), `event_date`,
`headline`, `body` (nullable markdown), `tags` (text[], nullable),
`source_id` (nullable fk), `kyle_annotation` (nullable), `is_published`
(default false), `created_at`, `updated_at`.

#### fleet_snapshots
Point-in-time vehicle counts per company/city. `city_id` nullable for
company-wide snapshots. Columns: `id` (pk), `company_id`, `city_id`
(nullable, fk cities), `snapshot_date`, `vehicle_count`,
`active_vehicle_count` (nullable), `source_id` (nullable), `notes`
(nullable), `created_at`.

#### ride_estimates
Ride volume estimates per company/city; `city_id` null = company-wide
(the CPUC quarterly series). `confidence` check: 'high'/'medium'/'low'.
Columns: `id` (pk), `company_id` (fk), `city_id` (nullable fk),
`period_start`, `period_end`, `rides_per_week` (normalized weekly),
`avg_fare_usd` (nullable), `source_id` (nullable fk), `confidence`,
`methodology_note`, `vehicle_miles_traveled` (nullable, 0007, CPUC VMT
ZEV), `created_at`.

#### financial_periods
Disclosed or modeled financials by fiscal period; `is_disclosed`
separates filing-sourced from estimated. Columns: `id` (pk), `company_id`
(fk), `fiscal_period` (e.g. 'Q1 2026'), `period_start`, `period_end`,
`revenue_usd`, `opex_usd`, `capex_usd`, `operating_loss_usd` (all
nullable numerics), `is_disclosed`, `source_id` (nullable fk),
`methodology_note`, `created_at`, `updated_at`.

#### disclosed_metrics
Point-in-time public disclosures (module 2.3), one row per
(company, metric, as_of); unique constraint on that triple makes seeding
idempotent. Metric slugs: 'weekly_rides', 'cumulative_trips',
'fleet_size', 'cities_count'. `attribution` check constraint:
'company' | 'investor' | 'media' | 'analyst'. Columns: `id` (pk),
`company_id` (fk), `metric`, `value` (numeric), `as_of` (date), `scope`
(default 'worldwide'; seeded rows use 'US'), `attribution` (default
'company'), `source_id` (nullable fk, always set in practice),
`stated_by`, `notes`, `created_at`, `updated_at`. Audit and updated_at
triggers attached. Seeded with Waymo's verified disclosure arc by
`scripts/seed-disclosed-metrics.ts` (8 weekly_rides incl. the Tiger
Global 450K investor figure, 4 cumulative_trips, 3 fleet_size).

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
- **Disclosed metrics convention (v2, module 2.3):** point-in-time public
  disclosures live in the `disclosed_metrics` table, one row per
  (company, metric, as_of). `attribution` separates company-confirmed
  rows from third-party ones; headline surfaces use company rows only,
  charts render company rows as filled dots and third-party as open dots.
  The old `site_content` `latest_*_disclosed` text convention is retired
  (row deleted by `scripts/seed-disclosed-metrics.ts`).
- **external_keys convention:** cities.external_keys is a jsonb map from
  source slug to that source's city identifier. Keys: `"robotaxi_tracker"`,
  `"nhtsa"`, etc. Populated lazily; scrapers write their key when first run.
  All 11 Waymo cities ship with empty `{}`.
- **Migration history:** 0001 initial; 0002 site_content; 0003 drop
  site_content trigger; 0004 cities unique (company_id, name); 0005
  service_area_geojson; 0006 external_keys + GIN; 0007 VMT field;
  0008 disclosed_metrics; 0009 cities 'employee' status.

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
| /admin/disclosed-metrics | full CRUD, attribution badges | insert, update, delete | / |
| /admin/companies, sources, fleet-snapshots, ride-estimates, financial-periods | full CRUD | insert, update, delete | none currently |
| /api/cron/scraper-health | daily CPUC freshness report to Slack (quarters in DB, pending, overdue) | none | n/a |
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
- **KeyStats:** 4-tile band. Tile 1 prefers disclosed worldwide rides
  (`getLatestDisclosedWeeklyRides()`), CPUC fallback with derived label.
  Tile 2 cities count. Tiles 3/4 CPUC trips and miles scoped (2.2) to the
  latest complete calendar year, labels derived from data; sub-quarter
  rows filtered defensively. All tiles use `<Metric>`; `--` when no data.
- **Operations:** server component. Fetches Waymo cities and CPUC
  quarterly chart data. Composes CityLaunchTimeline, QuarterlyTripsChart,
  CoverageMapClient, and methodology footnote.
- **NationalTrajectory:** server component (2.3), section id="trajectory"
  between KeyStats and Operations. Fetches the weekly_rides disclosure
  series and renders DisclosedRidesChart with framing copy and a footnote
  naming the latest company figure and the 1M target source.
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

### components/charts/

- **DisclosedRidesChart (client):** first chart in this directory (2.3).
  Recharts ComposedChart over epoch-ms time axis. Company disclosures:
  monotone line with filled dots; third-party figures: open dots, no
  line. 1M end-2026 target as dashed ReferenceLine annotation. Legend
  caption explains the dot convention. Tooltip shows figure, date,
  stated_by, attribution.

### components/milestones/

- **MilestoneCard:** shared card component for listing and landing page.
  Shows date, tag chips (using `tagLabel`), headline, body preview
  (line-clamp-3), and annotation. `linked` prop wraps in Next.js Link;
  false for non-linked uses.

### components/operations/

- **CityLaunchTimeline (client):** vertical accordion of all cities with
  a launch_date, sorted ascending. Full status badge map (2.4): Public
  accented; Waitlist/Employee-only outlined; Announced/Paused muted. One
  panel open at a time; Framer Motion height animation.
- **QuarterlyTripsChart (client):** Recharts LineChart of CPUC quarters.
  QoQ growth (signed) in tooltip. Framing paragraph sums the latest
  complete year, derived from data (2.2); grow/decline verb matches sign.
  Footnote derives next quarter's CPUC due date from lib/cpuc-calendar.
  Pending state when data array is empty.
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
- **lib/cpuc-calendar.ts:** pure CPUC filing-calendar logic (deadlines
  May 1/Aug 1/Nov 1/Feb 1, overdue-with-grace, label parsing). Dependency-
  free by design; imported by scraper, health cron, AND client chart
  components. Heavy scraper imports must never move here.
- **lib/scrapers/cpuc.ts:** v2 (2.2). `runCpucScrape()` fetches quarterly
  zips direct from cpuc.ca.gov (`waymo-deployment-YYYYqQ.zip`, stable since
  2025 Q2), unzips in memory (fflate, sub-2MB CSVs only), parses the
  Driverless AV_Month rollup by header name, sums the quarter, upserts
  ride_estimates (restatements update in place). Small CSVs archived to
  Storage `scraped-raw/cpuc/...`; per-quarter sources rows point at the zip
  URL. Missing quarter past deadline+grace posts Slack WARN. Weekly runs
  fetch missing plus two recent quarters; first-week runs re-verify all.
  Fixture tests: `scripts/test-cpuc-parser.ts` (tsx, no framework).
- **lib/disclosed-metrics.ts:** v2 (2.3), reads the `disclosed_metrics`
  table. `getLatestDisclosedWeeklyRides()` returns the latest COMPANY-
  attributed weekly_rides row joined to its source (null on none; callers
  fall back to CPUC). `getDisclosedSeries(metric)` returns the full arc,
  all attributions, ascending. Called by ThesisHero, KeyStats,
  NationalTrajectory.
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
| Supabase | live | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | linked project, RLS enabled; Storage bucket `scraped-raw` (private) holds raw scraped CSVs; Site URL = prod Vercel URL, Redirect URLs include localhost wildcard for dev magic links |
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
- **Smooth scroll** (`scroll-behavior: smooth`, `scroll-mt-20` sections);
  **lazy-loading** via `next/dynamic` `ssr: false` (CoverageMapClient);
  **admin mutations** via `supabaseAdmin` server actions in page files.
- **Em dashes:** forbidden everywhere. Commit prefix: `feat(N.N)`.
- **Derived copy:** dates, year labels, and "next filing due" text must be
  computed from data or lib/cpuc-calendar, never hardcoded (2.2 rule).
- **external_keys:** scrapers write city ids under their source slug; `{}` default.
- **Confidence levels:** disclosed sources `'high'`; community/estimated `'medium'`/`'low'`.
- **Methodology copy:** factual sections seeded by Claude Code; editorial
  framing user-authored, marked by invisible `<!-- TODO -->` comments.
  Content in `site_content` keyed `methodology_body`.
- **Public route layout (canonical):** `app/(public)/layout.tsx` wraps all
  `(public)` routes in PageShell; new public pages render content only.
  Homepage at root is the exception (calls PageShell directly). The 1.4
  milestones nav/footer bug came from this layout missing.
- **Admin server action error pattern:** capture `{ error }` from Supabase
  mutations; on error, throw `Failed to <verb> <table> row: ${error.message}`
  before `revalidatePath`/`redirect`. Applied uniformly across all admin actions.
- **Discoverability gate:** `SITE_PUBLIC=true` lifts the noindex gate; default unset.
  `proxy.ts` adds `X-Robots-Tag: noindex, nofollow, noarchive` to every public response (skipping /admin, /auth, /api); root `generateMetadata` emits the matching `<meta>`.

---

## Known gaps and debt

**Pre-launch:** see `pre-launch.md` at repo root.

**Resumption audit (2026-08-15, module 2.1), status after 2.2:**
- FIXED in 2.2: dead mirror (direct cpuc.ca.gov scraper), silent-skip
  semantics, placeholder health cron, all-quarters-summed-as-"2025" bug,
  hardcoded filing-date copy (now derived from the filing calendar).
- PENDING RUN: `scripts/fix-remove-stray-ride-row.ts` (stray 500000/wk
  row); needs local run with service key. KeyStats filters sub-quarter
  rows defensively either way.
- Waitlist/employee badge collapse in timeline and map popup: FIXED in
  2.4 (full status label maps). Remaining for 2.6: companies
  delete-confirm bug, missing revalidatePath calls, types regeneration.
- Supabase auto-pause resumed and repo made public 2026-08-15.

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
- Quantitative series are CA-only until 2.3 (national disclosed metrics)
  lands; pre-2025 CPUC baseline deferred to Phase 4.
- CPUC incident_metrics not ingested; safety-phase territory.
- lib/supabase/types.ts manually patched for 0006, 0007, 0008; regenerate
  with `supabase gen types typescript` in 2.6.

---

## Parking lot

- State-level fill on coverage map (US states colored by Waymo stage). Deferred 1.2.c.
- Robotaxi Tracker as corroborating signal (landscape phase); pre-2025 CPUC
  baseline via cpuc.ca.gov extraction (Phase 4, overlaps SEC EDGAR).

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
      cities/ companies/ milestones/ sources/ fleet-snapshots/
      ride-estimates/ financial-periods/ disclosed-metrics/
                                 full CRUD (list, new, [id]);
                                 milestones adds publish toggle
      site-content/            list + [key] edit
  api/
    cron/scraper-health/       daily health check

components/
  sections/
    PageShell.tsx
    ThesisHero.tsx + ThesisHeroCounter.tsx
    Thesis.tsx
    KeyStats.tsx
    NationalTrajectory.tsx
    Operations.tsx
    RecentMilestones.tsx
  charts/                      DisclosedRidesChart
  ui/                          Button, Card, Container, Heading, Prose,
                               Tooltip, Metric, Term, MarkdownBody
  operations/                  CityLaunchTimeline, QuarterlyTripsChart,
                               CoverageMap, CoverageMapClient
  milestones/                  MilestoneCard

lib/
  cohorts.ts, disclosed-metrics.ts, site-content.ts, notify.ts,
  last-updated.ts
  glossary/index.ts
  milestones/tags.ts
  scrapers/cpuc.ts
  supabase/                    server.ts, admin.ts, browser.ts, types.ts

supabase/
  migrations/                  0001 through 0009
  seed.sql                     6 company rows only

scripts/
  run-scraper-cpuc.ts          CPUC quarterly scraper entry point
  test-cpuc-parser.ts          fixture tests for scraper parse and calendar
  seed-*.ts, update-*.ts, fix-*.ts   one-time seed and content-fix scripts
                               (cities, milestones, methodology, site_content,
                               stray ride row)

.github/
  workflows/
    scrape-cpuc.yml            weekly Monday 13:17 UTC, workflow_dispatch
```
