# architecture.md

Living state of the codebase, refreshed at the end of every module that
changes schema, routes, components, conventions, integrations, or debt.
Read this at the start of every planning conversation. Not the plan
(dev-plan.md), not the working agreement (CLAUDE.md): it answers "what
currently exists." Hard rule: under 500 lines; consolidate past that.

---

## Last updated

Module: 4.4
Date: 2026-08-15
Commit: 4.4 work

---

## Schema

### Tables

#### companies
Reference table, 14 rows after 4.2 (Waymo, Zoox, Tesla, Nuro, Lucid,
Uber, Avride, May Mobility, Motional, Pony.ai, WeRide, Baidu Apollo Go,
Didi, plus Alphabet as SEC filer, not an operator). Columns: `id`, `slug`
(unique), `display_name`, `founded_year`, `parent_company`, `hq_country`,
`ownership`, `status_summary` (last three 0010), timestamps.

#### operator_programs, operator_program_roles (0010)
A program is the unit on the landscape page: the thing on the road.
`operator_programs`: `id`, `slug` (unique), `display_name`,
`lead_company_id`, `summary`, `is_active`, timestamps. Roles join
(composite pk program_id, company_id, role; role in 'av_developer' |
'vehicle_platform' | 'fleet_operator' | 'network'; no audit trigger,
acceptable for a pure join). Single-company programs hold all roles;
Uber's premium program is Nuro + Lucid + Uber; Uber also holds 'network'
on Waymo One, Apollo Go, Pony, WeRide, Avride, May Mobility, Motional.
11 programs seeded (`scripts/seed-operator-programs.ts`).

#### competitor_snapshots (0010)
Point-in-time readings per program; unique (program_id, snapshot_date).
Metric columns all nullable: `cities_serving_public`,
`cities_operating_total`, `vehicle_count`, `weekly_rides`,
`cumulative_rides`, `autonomous_miles_cumulative`, `funding_total_usd`,
`implied_valuation_usd`. `supervision` check ('driverless',
'safety_operator', 'mixed', 'human_is_legal_driver'); `disclosure_
quality` check ('regulatory', 'company_disclosed', 'earnings_disclosed',
'press_reported', 'estimated'). `source_id`, `notes`, timestamps.
Seeded 3.2 (11 rows); Apollo Go and Pony need a Q2 refresh after
2026-08-18 earnings.

#### sources
Every primary source linked to a data point; scrapers and admins both
insert. Columns: `id`, `url`, `publisher`, `title`, `published_at`,
`scraped_at`, `content_hash` (scraper dedupe), `storage_key` (raw doc in
Storage), `created_at`.

#### cities
One row per city per company. `status` check (0009): 'announced',
'waitlist', 'employee' (driverless ops, employee riders only), 'public',
'paused'. Waymo roster 18 rows (9 public, 2 waitlist, 4 employee, 3
announced with no launch_date, hidden from timeline/map). `program_id`
(nullable fk, 0010) links competitor cities to programs; 30 seeded in
3.2; Waymo rows leave it null and Waymo pages filter by company_id.
Columns: `id`, `company_id`, `name` (unique with company_id, 0004),
`metro_area`, `country`, `launch_date`, `public_access_date`,
`service_area_sq_mi`, `status`, `latitude`, `longitude`, `notes`,
`service_area_geojson` (jsonb, 0005, unused), `external_keys` (jsonb,
0006), `program_id`, timestamps.

#### milestones
Dated events in Waymo's history; drafts (`is_published = false`) are
admin-only via RLS. Columns: `id`, `company_id`, `event_date`, `headline`,
`body` (markdown), `tags` (text[]), `source_id`, `kyle_annotation`,
`is_published` (default false), timestamps.

#### fleet_snapshots
Point-in-time vehicle counts; `city_id` null = company-wide. Columns:
`id`, `company_id`, `city_id`, `snapshot_date`, `vehicle_count`,
`active_vehicle_count`, `source_id`, `notes`, `created_at`.

#### ride_estimates
Ride volume estimates per company/city; `city_id` null = company-wide
(the CPUC quarterly series). `confidence` check: 'high'/'medium'/'low'.
Columns: `id` (pk), `company_id` (fk), `city_id` (nullable fk),
`period_start`, `period_end`, `rides_per_week` (normalized weekly),
`avg_fare_usd` (nullable), `source_id` (nullable fk), `confidence`,
`methodology_note`, `vehicle_miles_traveled` (nullable, 0007, CPUC VMT
ZEV), `program_id` (nullable fk operator_programs, 0011), `tier`
('deployment' | 'pilot', nullable, 0011), `created_at`. Waymo's CPUC
deployment series: company_id = waymo, city_id null, program_id null.
Pilot series (Zoox, Nuro from Q2 2026): program_id set, tier 'pilot'.

#### financial_periods
Disclosed or modeled financials by fiscal period; `is_disclosed`
separates filing-sourced from estimated. Columns: `id`, `company_id`,
`fiscal_period` ('Q1 2026'), `period_start`, `period_end`, `revenue_usd`,
`opex_usd`, `capex_usd`, `operating_loss_usd`, `is_disclosed`,
`source_id`, `methodology_note`, timestamps.

#### disclosed_metrics
Point-in-time public disclosures (2.3), unique (company, metric, as_of).
Metric slugs: 'weekly_rides', 'cumulative_trips', 'fleet_size',
'cities_count'. `attribution` check: 'company' | 'investor' | 'media' |
'analyst'. Columns: `id`, `company_id`, `metric`, `value`, `as_of`,
`scope`, `attribution`, `source_id`, `stated_by`, `notes`, timestamps.
Seeded with Waymo's verified arc (8 weekly_rides incl. Tiger Global
450K as 'investor', 4 cumulative_trips, 3 fleet_size); also the target
of metric promotion from the earnings review queue (4.1).

#### earnings_events, waymo_mentions (0012, module 4.1)
`earnings_events`: one row per source document. `company_id` = filer
(Alphabet), `subject_company_id` = subject (Waymo), `fiscal_period`,
`event_type` check ('10-K','10-Q','8-K','earnings_call',
'shareholder_letter','investor_day','press_release'), `event_date`,
`source_id`, `storage_key`, `accession_number` (unique; SEC dedupe),
`processing_status` ('pending','extracted','reviewed','failed'),
`extraction_version`, `extraction_model`, `processed_at`, `error`,
`extraction_input_tokens`, `extraction_output_tokens`,
`extraction_chunks`, `mentions_dropped` (0013), timestamps. `waymo_mentions`: one per quote; `mention_type` check (11
values), `quote_text`, `speaker`, `extracted_metric` jsonb,
`confidence`, `kyle_annotation`, `review_status` ('pending','approved',
'rejected'), `page_or_timestamp`, `disclosed_metric_id` (set when
approval promotes a metric to disclosed_metrics), timestamps. RLS: anon
sees events and APPROVED mentions only (milestones pattern). Audit and
updated_at triggers on both. The v1 extracted_metrics table is dropped;
disclosed_metrics is the metrics store.

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
  service_area_geojson; 0006 external_keys + GIN; 0007 VMT; 0008
  disclosed_metrics; 0009 cities 'employee'; 0010 operator programs,
  roles, competitor_snapshots; 0011 ride_estimates program_id + tier;
  0012 earnings_events, waymo_mentions; 0013 extraction usage columns.

---

## Routes

### Public routes

All ISR 3600s with on-demand revalidation from the relevant admin
mutations.

| path | renders | data |
|------|---------|------|
| / | ThesisHero, Thesis, KeyStats, NationalTrajectory, Operations, RecentMilestones | ride_estimates, disclosed_metrics, site_content, cities, milestones |
| /milestones, /milestones/[id] | listing with tag chips; detail with source and annotation (404 for drafts) | milestones, sources |
| /methodology, /methodology/sources | methodology_body markdown; auto-generated source list by publisher | site_content, sources |
| /landscape | intro, OperatorTable, SupervisionStrip, regulatory section (CpucComparisonChart + Tesla sidebar), US OperatorMap, China/export + world map, methodology | operator_programs, roles, competitor_snapshots, ride_estimates, cities, site_content |

Not yet built: /unit-economics, /financials, /earnings, /safety, /outlook.

### Admin routes

Outer `app/admin/layout.tsx` is a passthrough (keeps `/admin/login`
public); the auth gate is `app/admin/(protected)/layout.tsx` (session
check, redirect to login). All mutations use `supabaseAdmin`. Every
mutation revalidates "/" at minimum (2.6); milestones also /milestones;
sources /methodology/sources; site-content /methodology(/sources);
programs and snapshots /landscape.

| path | purpose |
|------|---------|
| /admin/login, /auth/callback | magic link auth, Supabase callback |
| /admin | dashboard with row counts |
| /admin/{cities, companies, sources, fleet-snapshots, ride-estimates, financial-periods, disclosed-metrics, snapshots} | full CRUD (list, new, [id]); disclosed-metrics and snapshots show attribution/quality badges |
| /admin/milestones | CRUD plus publish toggle |
| /admin/earnings, /admin/earnings/[id] | events list with per-event pending/approved/rejected counts; review queue: approve/reject/save per mention, bulk approve, metric promotion to disclosed_metrics on approve (ride_count, city_count, fleet_size); event flips to 'reviewed' when no pending remain |
| /admin/programs | CRUD with company x role checkbox matrix (roles replaced wholesale on save) |
| /admin/site-content, /admin/site-content/[key] | list + create key; edit (upsert) |
| /api/cron/scraper-health | daily Slack freshness report (deployment quarters, pilot rows, pending, overdue) |

---

## Components

### components/sections/

- **PageShell:** async server component; sticky nav and footer with
  "Last updated" from `getGlobalLastUpdated()`. Nav links only routes
  that exist (Thesis, Trajectory, Operations, Milestones, Landscape;
  Methodology as meta-link); planned sections are added as they ship.
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

### components/landscape/ (3.3)

- **OperatorTable (client):** one row per program, sorted public-serving
  first then by weekly rides. Cells render "not disclosed" when null;
  `~` prefix on press-reported/estimated vehicle counts; cities as
  "public / total"; supervision pill; disclosure-quality badge with
  as-of month, tooltip carrying notes and source link. Partner roles
  listed under the operator name.
- **SupervisionStrip:** three bands (driverless public paid; supervised
  or not yet public; human is legal driver) from `isDriverlessPublic()`
  and the `human_is_legal_driver` supervision value. Column hoisted to
  module scope (react-hooks/static-components).
- **CpucComparisonChart (client):** Waymo deployment-tier vs pilot-tier
  quarterly CA trips on a log scale (solid vs dashed lines); regulatory
  data only. Fed by `getCpucComparison()`. Page shows a serif pending
  state until pilot rows exist.
- **OperatorMap (client) + OperatorMapClient:** separate lighter map from
  the Waymo CoverageMap (open decision 4 resolved): markers only, one
  color per program (`programColor()`), solid/ringed/hollow by status,
  hover popups, `region` prop 'us' | 'world' (naturalEarth projection
  for world). Client wrapper renders the legend.

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
- **CoverageMap (client):** Mapbox via CoverageMapClient (dynamic, ssr
  false). Circle polygons for cities with sq_mi, pins otherwise; non-
  public dashed; hover popups; editorial palette overrides.

---

## Libraries and integrations

### lib/

- **last-updated.ts:** `getGlobalLastUpdated()` max timestamp across data
  tables (PageShell footer). **milestones/tags.ts:** `MILESTONE_TAGS` (8
  slugs) + `tagLabel()`, single source of tag vocabulary. **cohorts.ts:**
  `getCohortBucket()` / `getBucketLegend()` for CoverageMap coloring.
  **notify.ts:** `notifySlack(message, level)`. **site-content.ts:**
  `getSiteContent(key)`. **glossary/index.ts:** 23 terms (3.3 added
  supervision_level, disclosure_quality, tcp_permit, nhtsa_exemption,
  standing_general_order).
- **cpuc-calendar.ts:** pure filing-calendar logic (deadlines May 1/Aug 1/
  Nov 1/Feb 1, overdue-with-grace, label parsing); dependency-free.
- **scrapers/cpuc.ts:** `runCpucScrape()`. Deployment tier (2.2):
  `waymo-deployment-YYYYqQ.zip` from cpuc.ca.gov, fflate-unzip sub-2MB
  CSVs, parse Driverless AV_Month by header, sum quarter, upsert Waymo
  ride_estimates (restatements in place), archive small CSVs to Storage
  `scraped-raw/cpuc/...`. Overdue quarter past grace = Slack WARN. Pilot
  tier (3.4): `av-pilot-YYYYqQ.zip`, `PILOT_CARRIERS` (Zoox, Nuro) month-
  level data per program, tier 'pilot'; absent carriers reported, not
  errored. Zoox files xlsx: **scrapers/cpuc-xlsx.ts** is a dependency-
  free "Month-Level" sheet reader; `extractPilotMonthCsv` handles CSV or
  xlsx. Aurora/Tensor/WeRide filings are non-template, out of scope.
  Tests `scripts/test-cpuc-parser.ts` (21).
- **scrapers/sec-edgar.ts (4.2):** `runEdgarScrape({since?})` polls
  `data.sec.gov/submissions/CIK{cik}.json` for `EDGAR_FILERS` (Alphabet
  -> Waymo); selects 10-K, 10-Q, and 8-K item 2.02 (earnings releases
  only); dedupes by accession_number; downloads primary doc plus the
  EX-99.1 exhibit for 8-Ks (`pickPressReleaseExhibit`) to Storage
  `scraped-raw/edgar/{cik}/{acc}/`; creates sources (publisher 'SEC
  EDGAR') and earnings_events ('pending'). 8-K fiscal period = quarter
  before release date. SCRAPER_USER_AGENT with email required; 2s
  delays. Entry `scripts/run-scraper-edgar.ts [--since]`; tests
  `scripts/test-edgar-parser.ts` (6, real submissions fixture).
- **scrapers/transcripts.ts (4.3):** `runTranscriptScrape({fromYear?})`
  fetches Motley Fool transcripts (robots-permitted, verified 2026-08)
  for `TRANSCRIPT_TARGETS` (Alphabet -> Waymo, tickers googl and goog).
  Discovery via Fool's monthly sitemaps (`sitemapMonths`, two per
  quarter; `findTranscriptUrls`), 1-2 requests per quarter; existing
  (filer, fiscal_period) 'earnings_call' events skipped; 429 or Fool's
  blocked page aborts the run. `extractTranscriptParagraphs` handles the
  current layout (H2 "Full Conference Call Transcript", "Name:" prefixes)
  and the classic pre-2025 layout (H2 "Prepared Remarks", speaker header
  paragraphs, ends at "Call participants"); `groupSpeakerTurns` produce
  page.html + turns.json at `scraped-raw/transcripts/{slug}/{yyyy}-q{q}/`;
  creates sources (publisher 'The Motley Fool') and 'pending' events.
  Entry `scripts/run-scraper-transcripts.ts [--from-year]`; tests
  `scripts/test-transcript-parser.ts` (9).
- **extraction/ (4.4):** `schema.ts` (Zod contract, `EXTRACTION_VERSION`,
  `EXTRACTION_MODEL` env-overridable, est. price constants);
  `text.ts` (HTML/turns.json to labelled passages `p{i}`/`t{i}`, table
  rows prefixed with caption + header + section via `annotateTableRows`,
  `selectRelevantPassages` keeps Waymo/Other Bets hits plus one
  neighbour, `chunkPassages` ~12K chars, `verifyQuote` normalised
  verbatim check); `extract.ts` (forced tool use `record_mentions`,
  `coerceExtractionOutput` shape repair, per-mention Zod validation,
  invalid or unverifiable mentions dropped and counted, speaker taken
  from the passage not the model; `ModelCaller` injectable); `run.ts`
  (`runExtraction({limit, eventId, includeFailed, reprocessBelowVersion})`
  loads Storage doc, dedupes identical metric/value/period mentions,
  writes pending waymo_mentions, replaces only pending rows on re-run, records tokens/chunks/dropped, Slack cost line
  per event). Zero relevant passages = 'extracted' with 0 mentions and
  0 model calls. Entry `scripts/run-extraction.ts` (`--dry-run --event`
  shows chunks without a model call); tests `scripts/test-extraction.ts`
  (13, fake model).
- **disclosed-metrics.ts:** reads `disclosed_metrics`.
  `getLatestDisclosedWeeklyRides()` = latest COMPANY row with source
  (hero, KeyStats; null falls back to CPUC); `getDisclosedSeries(metric)`
  = full arc, all attributions (NationalTrajectory).
- **landscape.ts (server) + landscape-types.ts (client-safe):** client
  components import only from landscape-types. `getLandscapePrograms()`
  joins programs, roles, latest snapshot, source; `getLandscapeCities()`
  and `getWaymoCitiesForMap()` feed the map; `getCpucComparison()` builds
  deployment-vs-pilot series (3.4).
- **supabase/:** server.ts (session client), admin.ts (service role,
  server-only), browser.ts (anon), types.ts (generated, hand-patched for
  0006 through 0013; regenerate with `supabase gen types typescript`).

### External integrations

| service | status | env vars | notes |
|---------|--------|---------|-------|
| Supabase | live | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | linked project, RLS enabled; Storage bucket `scraped-raw` (private) holds raw scraped CSVs; Site URL = prod Vercel URL, Redirect URLs include localhost wildcard for dev magic links |
| Mapbox | live | NEXT_PUBLIC_MAPBOX_TOKEN | CoverageMap (1.2.c) |
| Slack | live (prod) | SLACK_WEBHOOK_URL | production channel in Vercel; dev URL retained in .env.local |
| Anthropic API | live (4.4) | ANTHROPIC_API_KEY, EXTRACTION_MODEL (optional), EXTRACTION_PRICE_IN/OUT (optional) | `@anthropic-ai/sdk`, tool-use extraction, default `claude-sonnet-5` |
| Vercel Cron | live | CRON_SECRET | scraper-health daily; rotated in 1.6 |
| GitHub Actions | live | Supabase URL + service key, SCRAPER_USER_AGENT, SLACK_WEBHOOK_URL, ANTHROPIC_API_KEY | scrape-cpuc weekly Mon 13:17 UTC; scrape-edgar daily 14:07 (`since`); scrape-transcripts weekly Wed 15:11 (`from-year`); extract-earnings hourly :23 (`limit`, `include-failed`); all UTC, dispatch inputs in parens |
| SEC EDGAR | live (4.2) | SCRAPER_USER_AGENT | data.sec.gov submissions API + Archives; fair-use headers; Alphabet CIK 0001652044 |

---

## Conventions adopted

- **Pending-state pattern:** section + Container always rendered; pending
  branch is a serif paragraph, no Card.
- **Cohort coloring** via `getCohortBucket(launchDate)` (CoverageMap).
- **Revalidation:** server actions call `revalidatePath`; DB-level ISR
  triggers deferred. **Smooth scroll** + `scroll-mt-20`; **lazy-loading**
  via `next/dynamic` `ssr: false`; **admin mutations** via `supabaseAdmin`
  server actions in page files, error pattern `Failed to <verb> <table>
  row: ${error.message}` thrown before revalidate/redirect.
- **Em dashes:** forbidden everywhere. Commit prefix: `feat(N.N)`.
  **Derived copy:** dates and "next filing due" computed from data or
  lib/cpuc-calendar, never hardcoded (2.2 rule).
- **Client/server lib split:** client components import only from
  client-safe modules (landscape-types, cpuc-calendar); modules that
  touch supabase/server are never imported by "use client" files.
- **external_keys:** scrapers write city ids under their source slug;
  disclosed sources get confidence 'high', estimated lower.
- **Editorial copy in site_content:** factual sections seeded by Claude
  Code with `// TODO: user to replace`; page components fall back to
  inline copy when a key is absent (methodology_body, thesis_paragraphs,
  landscape_intro/china/regulatory/methodology).
- **Public route layout (canonical):** `app/(public)/layout.tsx` wraps all
  `(public)` routes in PageShell; homepage at root is the exception.
- **Discoverability gate:** `SITE_PUBLIC=true` lifts noindex; `proxy.ts`
  sets `X-Robots-Tag` and root `generateMetadata` emits the `<meta>`.

---

## Known gaps and debt

**Pre-launch:** see `pre-launch.md`. Resumption audit (2.1) fully resolved.

**Structural debt:**
- PENDING USER: regenerate lib/supabase/types.ts (hand-patched 0006 to
  0013) with `supabase gen types typescript --linked`; magic-link prod
  click-through not re-verified since 1.6; Baidu/Pony Q2 snapshot refresh
  after 2026-08-18 earnings; 33 extracted events awaiting review.
- `audit_trigger_fn` hard-coded to `NEW.id`; non-UUID PK tables excluded.
- `is_published` DB-level ISR trigger not wired; city detail pages not
  built; `service_area_geojson` unused.
- Planned routes not yet built: /financials, /earnings, /safety,
  /outlook, /unit-economics. Pre-2025 CPUC baseline and CPUC
  incident_metrics not ingested (later phases).

---

## Parking lot

- State-level map fill (1.2.c); Robotaxi Tracker as corroborating signal.

---

## Appendix: file structure quick map

```
app/
  page.tsx, layout.tsx, globals.css   landing composition, root layout, @theme
  (public)/                  layout.tsx wraps in PageShell; milestones/
                             (list, [id]), methodology/ (page, sources/),
                             landscape/ (3.3)
  admin/                     layout.tsx passthrough; login/; (protected)/
                             auth-gate layout + CRUD dirs (cities, companies,
                             milestones, sources, fleet-snapshots,
                             ride-estimates, financial-periods,
                             disclosed-metrics, programs, snapshots,
                             site-content, earnings review queue)
  api/cron/scraper-health/   daily CPUC freshness report

components/
  sections/                  PageShell, ThesisHero(+Counter), Thesis,
                             KeyStats, NationalTrajectory, Operations,
                             RecentMilestones
  charts/                    DisclosedRidesChart
  ui/                        Button, Card, Container, Heading, Prose,
                             Tooltip, Metric, Term, MarkdownBody
  operations/                CityLaunchTimeline, QuarterlyTripsChart,
                             CoverageMap(+Client)
  milestones/                MilestoneCard
  landscape/                 OperatorTable, SupervisionStrip,
                             OperatorMap(+Client), CpucComparisonChart
  admin/                     ConfirmDeleteButton

lib/
  cohorts, disclosed-metrics, site-content, notify, last-updated,
  cpuc-calendar, landscape (server), landscape-types (client-safe)
  glossary/index.ts, milestones/tags.ts, scrapers/{cpuc,cpuc-xlsx,sec-edgar,transcripts}.ts
  extraction/{schema,text,extract,run}.ts
  supabase/                  server, admin, browser, types

supabase/                    migrations/ 0001-0013; seed.sql (6 companies)
scripts/                     run-scraper-{cpuc,edgar,transcripts}, run-extraction,
                             test-*-parser, test-extraction,
                             and idempotent seed-*/update-*/fix-* scripts
.github/workflows/           scrape-{cpuc,transcripts}.yml (weekly), scrape-edgar.yml
                             (daily), extract-earnings.yml (hourly)
```
