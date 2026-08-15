# architecture.md

Living state of the codebase, refreshed at the end of every module that
changes schema, routes, components, conventions, integrations, or debt.
Read this at the start of every planning conversation. Not the plan
(dev-plan.md), not the working agreement (CLAUDE.md): it answers "what
currently exists." Hard rule: under 500 lines; consolidate past that.

---

## Last updated

Module: 3.2
Date: 2026-08-15
Commit: 3.2 work

---

## Schema

### Tables

#### companies
Reference table, 13 rows after 3.1 (Waymo, Zoox, Tesla, Nuro, Lucid,
Uber, Avride, May Mobility, Motional, Pony.ai, WeRide, Baidu Apollo Go,
Didi). Columns: `id` (pk), `slug` (unique), `display_name`,
`founded_year`, `parent_company`, `hq_country`, `ownership`,
`status_summary` (one admin-maintained sentence; the last three added
0010), `created_at`, `updated_at`.

#### operator_programs, operator_program_roles (0010)
A program is the unit on the landscape page: the thing actually on the
road. `operator_programs`: `id` (pk), `slug` (unique), `display_name`,
`lead_company_id` (fk), `summary`, `is_active`, timestamps. Roles join
(composite pk program_id, company_id, role; role in 'av_developer' |
'vehicle_platform' | 'fleet_operator' | 'network'; no audit trigger per
the composite-pk limitation, acceptable for a pure join table). Single-
company programs hold all roles; Uber's premium program is Nuro
(av_developer) + Lucid (vehicle_platform) + Uber (fleet_operator,
network); Uber also holds 'network' on Waymo One, Apollo Go, Pony,
WeRide, Avride, May Mobility, Motional. 11 programs seeded by
`scripts/seed-operator-programs.ts`.

#### competitor_snapshots (0010)
Point-in-time operational readings per program; unique (program_id,
snapshot_date). All metric columns nullable by design: `cities_serving_
public`, `cities_operating_total`, `vehicle_count`, `weekly_rides`,
`cumulative_rides`, `autonomous_miles_cumulative`, `funding_total_usd`,
`implied_valuation_usd`. `supervision` check: 'driverless' |
'safety_operator' | 'mixed' | 'human_is_legal_driver' (the last exists
for Tesla's Bay Area TCP operation). `disclosure_quality` check:
'regulatory' | 'company_disclosed' | 'earnings_disclosed' |
'press_reported' | 'estimated'. `source_id`, `notes`, timestamps; audit
and updated_at triggers. Seeded 3.2 with one row per program (11) by
`scripts/seed-competitor-snapshots.ts`; Apollo Go and Pony rows are Q1
2026 and need a Q2 refresh after their 2026-08-18 earnings.

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
`program_id` (nullable fk operator_programs, 0010) links competitor
cities to their program; Waymo rows leave it null. 30 competitor city
rows seeded in 3.2 (Zoox, Tesla, Nuro/Lucid/Uber, Apollo Go, Pony,
WeRide, Avride, May, Motional). Waymo-only pages filter by Waymo's
company_id and are unaffected. `service_area_geojson`
is reserved; the map derives circles from `service_area_sq_mi` only.
`external_keys` is populated lazily by scrapers (empty `{}` by default).
Columns: `id` (pk), `company_id` (fk), `name` (unique with company_id,
0004), `metro_area`, `country` (default 'US'), `launch_date`,
`public_access_date`, `service_area_sq_mi`, `status`, `latitude`,
`longitude`, `notes`, `service_area_geojson` (jsonb, 0005),
`external_keys` (jsonb not null default '{}', 0006), `program_id`
(0010), `created_at`, `updated_at`.

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
Key/value store for admin-editable editorial copy: `key` (text pk, e.g.
'thesis_paragraphs'), `markdown_body`, `updated_at`. No audit trigger
(text pk; see CLAUDE.md audit trigger limitation).

#### audit_log
Append-only log written by `audit_trigger_fn()`. Admin-read only via
RLS. `record_id` is UUID; trigger only fires on tables with UUID `id`
columns. Columns: `id` (pk), `user_id` (nullable), `table_name`,
`record_id`, `action` ('insert'/'update'/'delete'), `before` (jsonb,
nullable), `after` (jsonb, nullable), `created_at`.

### Cross-cutting schema notes

- **RLS model:** public SELECT on all tables except `milestones`
  (published only for anon) and `audit_log` (admin only); writes require
  `is_admin()` (SQL fn in 0001 reading `app_metadata.is_admin` from the
  JWT; set via service-role client or dashboard).
- **Audit triggers:** `audit_trigger_fn()` on every UUID-pk table
  (companies, sources, cities, milestones, fleet_snapshots,
  ride_estimates, financial_periods, disclosed_metrics, operator_programs,
  competitor_snapshots). Not on `site_content` (text pk),
  `operator_program_roles` (composite pk), or `audit_log`.
- **updated_at triggers:** companies, cities, milestones,
  financial_periods, site_content, disclosed_metrics, operator_programs,
  competitor_snapshots.
- **Disclosed metrics convention (2.3):** point-in-time disclosures in
  `disclosed_metrics`; `attribution` separates company-confirmed from
  third-party; headline surfaces use company rows only, charts render
  filled vs open dots. The `site_content` `latest_*_disclosed` text
  convention is retired.
- **external_keys convention:** cities.external_keys is a jsonb map from
  source slug to that source's city id; populated lazily by scrapers.
- **Migration history:** 0001 initial; 0002 site_content; 0003 drop
  site_content trigger; 0004 cities unique (company_id, name); 0005
  service_area_geojson; 0006 external_keys + GIN; 0007 VMT field;
  0008 disclosed_metrics; 0009 cities 'employee' status; 0010
  operator programs, roles, competitor_snapshots, companies fields.

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
| /admin/programs | operator programs CRUD with role matrix (company x role checkboxes; roles replaced wholesale on save) | insert, update, delete | /landscape |
| /admin/snapshots | competitor snapshots CRUD, quality badges | insert, update, delete | /landscape |
| /admin/companies, sources, fleet-snapshots, ride-estimates, financial-periods | full CRUD | insert, update, delete | none currently |
| /api/cron/scraper-health | daily CPUC freshness report to Slack (quarters in DB, pending, overdue) | none | n/a |
| /auth/callback | Supabase auth callback | n/a | n/a |

Note: all admin mutations now revalidate "/" at minimum (2.6). Sources
also revalidates /methodology/sources; site-content revalidates
/methodology and /methodology/sources.

---

## Components

### components/sections/

- **PageShell:** async server component; sticky nav and footer with
  "Last updated" from `getGlobalLastUpdated()`. Methodology as meta-link.
- **ThesisHero:** hero with animated ride count (ThesisHeroCounter,
  client, Framer Motion). Prefers `getLatestDisclosedWeeklyRides()` over
  CPUC; caption reflects which. Serif pending state when both null.
- **Thesis:** renders `thesis_paragraphs` from `site_content`; null if
  absent.
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
- **RecentMilestones:** 5 most recent published milestones as
  MilestoneCards with "View all" link; null if none. id="milestones".

### components/ui/

- **Container, Prose, Heading, Button, Card:** design system primitives.
- **Tooltip** (Radix, 8s auto-dismiss, mobile tap); **Metric** (value +
  info icon, tooltip with explanation/source/as-of); **Term** (dotted
  underline, glossary lookup by key).
- **MarkdownBody:** react-markdown + remark-gfm + rehype-raw; HTML
  comments pass through invisibly. Admin-authored content only, so
  rehype-raw is safe here.

### components/charts/

- **DisclosedRidesChart (client):** first chart in this directory (2.3).
  Recharts ComposedChart over epoch-ms time axis. Company disclosures:
  monotone line with filled dots; third-party figures: open dots, no
  line. Every dot is an SVG link to its source row's URL (2.6, opens in
  new tab; tooltip says so). 1M end-2026 target as dashed ReferenceLine.
  Legend caption explains the dot convention.

### components/admin/

- **ConfirmDeleteButton (client):** two-step delete confirm for admin
  server-action forms (first click arms, second submits; disarms on blur
  or 5s). Replaces browser confirm() dialogs, which cannot work on server
  component forms. Used by every admin delete form (2.6).

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
- **CoverageMap (client):** Mapbox GL JS via CoverageMapClient (dynamic
  import, ssr: false, pulsing skeleton). Circle polygons for cities with
  sq_mi, 8px pins otherwise; non-public styling dashed/reduced; hover
  popups; editorial palette overrides on load.

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
- **Admin server action error pattern:** capture `{ error }`; on error
  throw `Failed to <verb> <table> row: ${error.message}` before
  `revalidatePath`/`redirect`. Uniform across all admin actions.
- **Discoverability gate:** `SITE_PUBLIC=true` lifts noindex; default
  unset. `proxy.ts` sets `X-Robots-Tag: noindex, nofollow, noarchive` on
  public responses; root `generateMetadata` emits the matching `<meta>`.

---

## Known gaps and debt

**Pre-launch:** see `pre-launch.md` at repo root.

**Resumption audit (2026-08-15, module 2.1):** all findings resolved
across 2.2-2.6: dead mirror (direct scraper), silent-skip semantics,
placeholder health cron, year-scoping bug, hardcoded filing dates, stray
500K row deleted, badge collapse, delete-confirm (ConfirmDeleteButton on
all 8 admin delete forms), revalidatePath on all mutations. Supabase
auto-pause resumed and repo made public 2026-08-15. PENDING USER:
regenerate lib/supabase/types.ts after 0010 is pushed
(`supabase gen types typescript --linked > lib/supabase/types.ts`) and
the magic-link prod retest deferred since 1.6.

**Structural debt:**
- Magic-link prod click-through never re-verified since 1.6 (user task).
- `audit_trigger_fn` hard-coded to `NEW.id`; non-UUID PK tables excluded
  (site_content, operator_program_roles). See CLAUDE.md.
- `is_published` DB-level ISR trigger not wired; admin mutation
  revalidation covers it.
- City detail pages not built; timeline shows disabled links.
- `service_area_geojson` exists but unused; polygon rendering deferred.
- Public routes /landscape, /financials, /earnings, /safety, /outlook,
  /unit-economics are still stubs (landscape lands in 3.3).
- Resolved in Phase 2 (kept for history): companies delete-confirm,
  revalidatePath gaps, site_content YAML disclosed-metrics convention.
- Quantitative series are CA-only until 2.3 (national disclosed metrics)
  lands; pre-2025 CPUC baseline deferred to Phase 4.
- CPUC incident_metrics not ingested; safety-phase territory.
- lib/supabase/types.ts manually patched for 0006 through 0010; regenerate
  with `supabase gen types typescript` (pending user).

---

## Parking lot

- State-level fill on coverage map (deferred 1.2.c); Robotaxi Tracker as
  corroborating signal (landscape); pre-2025 CPUC baseline (Phase 4).

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
      programs/ snapshots/       full CRUD (list, new, [id]);
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
  migrations/                  0001 through 0010
  seed.sql                     6 company rows only

scripts/
  run-scraper-cpuc.ts          CPUC quarterly scraper entry point
  test-cpuc-parser.ts          fixture tests for scraper parse and calendar
  seed-*.ts, update-*.ts, fix-*.ts   idempotent seed and fix scripts
                               (cities, milestones, disclosed metrics,
                               operator programs, competitor snapshots,
                               methodology, site_content)

.github/
  workflows/
    scrape-cpuc.yml            weekly Monday 13:17 UTC, workflow_dispatch
```
