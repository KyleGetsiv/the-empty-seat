# architecture.md

Living state of the codebase, refreshed at the end of every module that
changes schema, routes, components, conventions, integrations, or debt.
Read this at the start of every planning conversation. Not the plan
(dev-plan.md), not the working agreement (CLAUDE.md): it answers "what
currently exists." Hard rule: under 500 lines; consolidate past that.

---

## Last updated

Module: 4.5
Date: 2026-08-15
Commit: 4.5 work

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
`extraction_chunks`, `mentions_dropped` (0013), timestamps.
`waymo_mentions`: one per quote; `mention_type` check (11 values),
`quote_text`, `speaker`, `extracted_metric` jsonb, `confidence`,
`kyle_annotation`, `review_status` ('pending','approved','rejected'),
`page_or_timestamp` (the extraction passage id, resolvable in the source
viewer), `disclosed_metric_id` (set when approval promotes a metric),
timestamps. RLS: anon sees events and APPROVED mentions only. Audit and
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
check, redirect to login). All mutations use `supabaseAdmin` and
revalidate "/" at minimum (2.6); milestones also /milestones; sources
/methodology/sources; site-content /methodology(/sources); programs and
snapshots /landscape.

| path | purpose |
|------|---------|
| /admin/login, /auth/callback | magic link auth, Supabase callback |
| /admin | dashboard with row counts |
| /admin/{cities, companies, sources, fleet-snapshots, ride-estimates, financial-periods, disclosed-metrics, snapshots} | full CRUD (list, new, [id]); disclosed-metrics and snapshots show attribution/quality badges |
| /admin/milestones | CRUD plus publish toggle |
| /admin/earnings | events list with per-event pending/approved/rejected/dropped counts; filters (processing status, type, review state, period) via searchParams; "Review next unreviewed" jump |
| /admin/earnings/[id] | review queue: approve/reject/save per mention, mention status filter, needs-a-number guard, bulk approve (skips metric mentions with no number), metric promotion to disclosed_metrics on approve, drop log, reprocess, next-unreviewed link; event flips to 'reviewed' when no pending remain |
| /admin/earnings/[id]/source | the stored document rendered as extraction passages, cited passage highlighted; toggle between the passages extraction read and the full document |
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
- **Thesis:** renders `thesis_paragraphs` from `site_content`, else null.
- **KeyStats:** 4-tile band. Tile 1 prefers disclosed worldwide rides
  (`getLatestDisclosedWeeklyRides()`), CPUC fallback with derived label;
  tile 2 cities count; tiles 3/4 CPUC trips and miles scoped (2.2) to the
  latest complete calendar year, labels from data, sub-quarter rows
  filtered. All tiles use `<Metric>`; `--` when no data.
- **Operations:** server component. Fetches Waymo cities and CPUC
  quarterly data; composes CityLaunchTimeline, QuarterlyTripsChart,
  CoverageMapClient, methodology footnote.
- **NationalTrajectory:** server component (2.3), id="trajectory" between
  KeyStats and Operations. Renders DisclosedRidesChart over the
  weekly_rides series with framing copy and a footnote naming the latest
  company figure and the 1M target source.
- **RecentMilestones:** five most recent published milestones as
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

- **DisclosedRidesChart (client, 2.3):** Recharts ComposedChart over an
  epoch-ms axis. Company disclosures: monotone line, filled dots;
  third-party figures: open dots, no line. Every dot is an SVG link to its
  source URL (2.6, new tab). 1M end-2026 target as a dashed ReferenceLine;
  legend caption explains the dot convention.

### components/admin/

- **ConfirmDeleteButton (client):** two-step delete confirm for admin
  server-action forms (first click arms, second submits; disarms on blur
  or 5s). Replaces browser confirm() dialogs, which cannot work on server
  component forms. Used by every admin delete form (2.6).
- **MentionCard (client, 4.5):** one reviewable mention. Client only so
  the needs-a-number guard can track the type select and value input live:
  a metric-type mention with no number cannot be approved until a value is
  entered or the opt-out is ticked. The server action arrives as a prop, so
  the card is still a form post.

### components/landscape/ (3.3)

- **OperatorTable (client):** one row per program, sorted public-serving
  first then by weekly rides. Cells render "not disclosed" when null;
  `~` prefix on press-reported/estimated vehicle counts; cities as
  "public / total"; supervision pill; disclosure-quality badge with
  as-of month, tooltip carrying notes and source link. Partner roles
  listed under the operator name.
- **SupervisionStrip:** three bands (driverless public paid; supervised or
  not yet public; human is legal driver) from `isDriverlessPublic()` and
  the `human_is_legal_driver` supervision value.
- **CpucComparisonChart (client):** Waymo deployment-tier vs pilot-tier
  quarterly CA trips on a log scale (solid vs dashed); regulatory data
  only, from `getCpucComparison()`. Serif pending state until pilot rows
  exist.
- **OperatorMap (client) + OperatorMapClient:** lighter map than the Waymo
  CoverageMap: markers only, one color per program (`programColor()`),
  solid/ringed/hollow by status, hover popups, `region` prop 'us' |
  'world' (naturalEarth for world). Client wrapper renders the legend.

### components/milestones/

- **MilestoneCard:** shared by the listing and landing page. Date, tag
  chips (`tagLabel`), headline, body preview (line-clamp-3), annotation.
  `linked` prop wraps in a Next.js Link.

### components/operations/

- **CityLaunchTimeline (client):** vertical accordion of cities with a
  launch_date, ascending. Status badges (2.4): Public accented,
  Waitlist/Employee outlined, Announced/Paused muted. One panel open at a
  time, Framer Motion height animation.
- **QuarterlyTripsChart (client):** Recharts LineChart of CPUC quarters,
  signed QoQ growth in the tooltip. Framing paragraph sums the latest
  complete year from data (2.2), verb matching the sign; footnote derives
  the next CPUC due date from lib/cpuc-calendar. Pending state when empty.
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
  `getSiteContent(key)`. **glossary/index.ts:** 23 terms.
- **cpuc-calendar.ts:** pure filing-calendar logic (deadlines May 1/Aug 1/
  Nov 1/Feb 1, overdue-with-grace, label parsing); dependency-free.
  Scraper and extraction internals (why each parser looks the way it does)
  live in the dev-plan "(Built ...)" notes; these bullets say what exists.
- **scrapers/cpuc.ts:** `runCpucScrape()` over cpuc.ca.gov quarterly zips.
  Deployment tier (2.2) upserts Waymo ride_estimates, restatements in
  place, Slack WARN past grace; pilot tier (3.4) writes per-program rows
  for `PILOT_CARRIERS` (Zoox, Nuro), absent carriers reported not errored.
  **cpuc-xlsx.ts** reads Zoox's xlsx. Non-template filers out of scope.
- **scrapers/sec-edgar.ts (4.2):** `runEdgarScrape({since?})` over the
  submissions API for `EDGAR_FILERS`; 10-K, 10-Q, 8-K item 2.02 only;
  dedupes on accession_number; primary doc plus EX-99.1 to Storage;
  creates sources and 'pending' events. Needs SCRAPER_USER_AGENT.
- **scrapers/transcripts.ts (4.3):** `runTranscriptScrape({fromYear?})`
  discovers Motley Fool transcripts via their monthly sitemaps, parses
  current and pre-2025 layouts to speaker turns, writes page.html plus
  turns.json and 'pending' events; a 429 or blocked page aborts the run.
- **extraction/ (4.4, 4.5):** `schema.ts` (zod contract, version, model,
  prices); `text.ts` (document to labelled passages `p{i}`/`t{i}`, table
  rows prefixed with caption and header, relevance filter plus one
  neighbour, ~12K chunks, `verifyQuote`); `extract.ts` (forced tool use,
  shape repair, per-mention validation, speaker from the passage not the
  model, injectable `ModelCaller`, drops described not counted);
  `drop-log.ts` (4.5, convention below); `run.ts` (`runExtraction({limit,
  eventId, includeFailed, reprocessBelowVersion})` dedupes identical
  metric/value/period mentions, replaces only pending rows on re-run,
  records usage, writes the drop log, Slack cost line). Zero relevant
  passages = 'extracted', 0 mentions, 0 model calls. Entry
  `scripts/run-extraction.ts`; tests 21/6/9/14 across the four suites.
- **earnings-mentions.ts (4.5, client-safe):** `MENTION_TYPES`,
  `METRIC_PROMOTION` (ride_count -> weekly_rides, city_count ->
  cities_count, fleet_size -> fleet_size), `REVIEW_STATUSES`,
  `EVENT_TYPES`, `PROCESSING_STATUSES`: one vocabulary for the review
  queue's client components and the zod enums in extraction/schema.
  **earnings-review.ts (4.5, server):** `getMentionCountsByEvent()` and
  `getNextUnreviewedEventId(excludeId?)` (oldest event still pending).
- **disclosed-metrics.ts:** reads `disclosed_metrics`.
  `getLatestDisclosedWeeklyRides()` = latest COMPANY row with source
  (hero, KeyStats; null falls back to CPUC); `getDisclosedSeries(metric)`
  = full arc, all attributions (NationalTrajectory).
- **landscape.ts (server) + landscape-types.ts (client-safe):**
  `getLandscapePrograms()` joins programs, roles, latest snapshot, source;
  `getLandscapeCities()` and `getWaymoCitiesForMap()` feed the map;
  `getCpucComparison()` builds deployment-vs-pilot series (3.4).
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
| GitHub Actions | live | Supabase URL + service key, SCRAPER_USER_AGENT, SLACK_WEBHOOK_URL, ANTHROPIC_API_KEY | scrape-cpuc weekly Mon 13:17 UTC; scrape-edgar daily 14:07 (`since`); scrape-transcripts weekly Wed 15:11 (`from-year`); extract-earnings hourly :23 (`event`, `limit`, `include-failed`); all UTC, dispatch inputs in parens. Inputs reach the shell through env and positional args, never string interpolation |
| GitHub API | pending token (4.5) | GITHUB_DISPATCH_TOKEN, GITHUB_REPO, GITHUB_DISPATCH_REF | admin reprocess button dispatches extract-earnings.yml for one event; fine-grained PAT with Actions read and write |
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
  client-safe modules (landscape-types, cpuc-calendar, earnings-mentions);
  modules touching supabase/server are never imported by "use client".
- **external_keys:** scrapers write city ids under their source slug;
  disclosed sources get confidence 'high', estimated lower.
- **Editorial copy in site_content:** factual sections seeded with
  `// TODO: user to replace`; page components fall back to inline copy
  when a key is absent.
- **Public route layout (canonical):** `app/(public)/layout.tsx` wraps all
  `(public)` routes in PageShell; homepage at root is the exception.
- **Discoverability gate:** `SITE_PUBLIC=true` lifts noindex; `proxy.ts`
  sets `X-Robots-Tag` and root `generateMetadata` emits the `<meta>`.
- **Extraction drop log (4.5):** every run writes
  `scraped-raw/extraction-logs/{event_id}/v{version}.json`, one entry per
  discarded quote with reason ('invalid_schema' or 'unverified'), chunk,
  and locator; written even when nothing was dropped, so a missing log
  means "extracted before 4.5", not "lost nothing". Storage not a column,
  so diagnostics need no migration; a write failure warns, never fails the
  run. Its quotes are model output and are labelled as such. **Long admin
  work dispatches, it does not run in the request:** the reprocess button
  posts a workflow_dispatch to extract-earnings.yml, which a multi-chunk
  10-K would outrun inside a Vercel function.

---

## Known gaps and debt

**Pre-launch:** see `pre-launch.md`. Resumption audit (2.1) fully resolved.

**Structural debt:**
- PENDING USER: regenerate lib/supabase/types.ts (hand-patched 0006 to
  0013); magic-link prod click-through not re-verified since 1.6;
  Baidu/Pony Q2 snapshot refresh after 2026-08-18 earnings;
  disclosed_metrics rows promoted in the 4.5 review pass not yet
  spot-checked (Other Bets figures promoted as Waymo, same-date events
  colliding on the (company, metric, as_of) upsert); no
  GITHUB_DISPATCH_TOKEN, so reprocess stays disabled.
- The 33 backfilled events predate the drop log, so their dropped quotes
  (5 on the Q3 2025 call among them) exist only as counts; reprocessing
  produces a log, but the model is not deterministic and may drop a
  different set. Source-viewer passage ids are re-derived by the current
  parser, so a text.ts change can shift them out of step with old locators.
- `is_published` DB-level ISR trigger not wired; city detail pages not
  built; `service_area_geojson` unused. `audit_trigger_fn` hard-coded to
  `NEW.id`; non-UUID PK tables excluded.
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
                             site-content, earnings/ (list, [id] review
                             queue, [id]/source stored-source viewer))
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
  admin/                     ConfirmDeleteButton, MentionCard

lib/
  cohorts, disclosed-metrics, site-content, notify, last-updated,
  cpuc-calendar, landscape (server), landscape-types (client-safe),
  earnings-review (server), earnings-mentions (client-safe)
  glossary/, milestones/tags, scrapers/{cpuc,cpuc-xlsx,sec-edgar,transcripts}
  extraction/{schema,text,extract,drop-log,run}
  supabase/                  server, admin, browser, types

supabase/                    migrations/ 0001-0013; seed.sql (6 companies)
scripts/                     run-scraper-{cpuc,edgar,transcripts}, run-extraction,
                             test-*, idempotent seed-*/update-*/fix-*
.github/workflows/           scrape-{cpuc,transcripts} weekly, scrape-edgar daily,
                             extract-earnings hourly
```
