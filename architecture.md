# architecture.md

Living state of the codebase, refreshed at the end of every module that
changes schema, routes, components, conventions, integrations, or debt.
Read this at the start of every planning conversation. Not the plan
(dev-plan.md), not the working agreement (CLAUDE.md): it answers "what
currently exists." Per-table schema detail lives in `schema.md`. Hard
rule: under 500 lines; consolidate past that.

---

## Last updated

Module: 1.2.c (state fill, marker encoding)
Date: 2026-08-19
Commit: coverage map marker hierarchy and legend

---

## Schema

### Tables

Per-table detail is in `schema.md`: what each table means, the convention
it encodes, and its gotchas. Column lists are in `supabase/migrations/`
and `lib/supabase/types.ts`. The cross-cutting notes below stay here
because they are conventions, not reference.

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
  tile 2 cities count (from `cities`, not disclosed_metrics); tiles 3/4 CPUC
  trips and miles scoped (2.2) to the latest complete calendar year, labels
  from data. All tiles use `<Metric>`; `--` when no data.
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

- **DisclosedRidesChart (client, 2.3):** Recharts ComposedChart, epoch-ms
  axis. Company disclosures: monotone line, filled dots; third-party: open
  dots, no line (so Tiger Global's 450K sitting above Waymo's own 400K reads
  correctly). Dots link to source; 1M end-2026 target as a dashed
  ReferenceLine.

### components/admin/

- **ConfirmDeleteButton (client):** two-step delete confirm for admin
  server-action forms (first click arms, second submits; disarms on blur or
  5s), replacing confirm() dialogs, which cannot work on server component
  forms. Used by every admin delete form (2.6).
- **MentionCard (client, 4.5):** one reviewable mention. Client only so
  the needs-a-number guard can track the type select and value input live:
  a metric-type mention with no number cannot be approved until a value is
  entered or the opt-out is ticked. The server action arrives as a prop, so
  the card is still a form post.

### components/landscape/ (3.3)

- **OperatorTable (client):** one row per program, public-serving first then
  by weekly rides. "not disclosed" for nulls; `~` on press-reported or
  estimated counts; cities as "public / total"; supervision pill;
  disclosure-quality badge with as-of month, tooltip with notes and source;
  partner roles under the operator name.
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
  'world' (naturalEarth for world). US frame also draws the state presence
  fill, gated on program supervision; world frame does not. Client wrapper
  renders the program and state legends.

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
  false). One uniform dot per city (solid public, ringed limited), colored
  by cohort; cities with sq_mi also get a true-to-scale polygon that
  emerges from behind the dot on zoom, halo fading by z8. State presence
  fill beneath at 0.35 opacity. Wrapper legends state shading, dot color
  (cohort ramp via `getBucketLegend`), and dot shape.

---

## Libraries and integrations

### lib/

- **state-tiers.ts (client-safe) + state-fill-layer.ts:** the state fill.
  Tier from `cities.status` (public 3, waitlist/employee 2,
  announced/paused 1), gated by `supervisionCountsAsDriverless`;
  `computeStateTiers` ray-casts against `public/us-states.json` with a bbox
  prefilter, highest tier wins, warns in dev when a city matches no state.
  `addStateFill` inserts fill and outline below the base water layer and
  no-ops if the fetch fails. Ramp #EDF2F7/#C6D4E2/#9FB6CC.
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
  **earnings-promote.ts (fix(4.5), server):** `decidePromotion()` (pure,
  tested), `promoteMetric()`, `withdrawPromotion()`.
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
  triggers deferred. A script writing straight to the database bypasses
  this, so its change stays invisible until ISR expires or an admin
  mutation runs. **Smooth scroll** + `scroll-mt-20`; **lazy-loading**
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
- **Metric promotion is one row per figure (fix(4.5)):** a reaffirmation
  links to the existing (company, metric, value) row and appends to its
  notes; only an unseen figure inserts, and an earlier event re-dates the
  row. Promotion is withdrawn when a mention leaves a promoting type or is
  rejected, deleting the row only if no approved mention still cites it.
  `notes` carries no ids: the `<Metric>` tooltip can surface it publicly.
- **Map fill is tier, never count (1.2.c):** the state choropleth encodes
  the most advanced driverless service a state has reached, not deployment
  density; a count would put Tesla's safety-driver service on the same axis
  as Waymo's paid driverless, so supervised programs do not shade at all.
  No supervised band exists because every state hosting one also hosts
  driverless paid service. Legends say presence, never coverage.
- **Marker size encodes only what is measured (1.2.c):** size carries
  service area and nothing else. Encoding data availability as size made
  undisclosed markets the largest marks on the map (a fixed 8px pin against
  Phoenix's 3.9px at z4); absence is now the missing polygon. Any color or
  size channel on a map needs a legend row, or readers infer one.
- **Extraction drop log (4.5):** every run writes
  `scraped-raw/extraction-logs/{event_id}/v{version}.json`, one entry per
  discarded quote (reason, chunk, locator), written even when nothing was
  dropped, so a missing log means "extracted before 4.5". Its quotes are
  model output and are labelled as such; a write failure warns, never fails
  the run. **Long admin work dispatches, it does not run in the request:**
  reprocess posts a workflow_dispatch to extract-earnings.yml, which a
  multi-chunk 10-K would outrun inside a Vercel function.

---

## Known gaps and debt

**Pre-launch:** see `pre-launch.md`. Resumption audit (2.1) fully resolved.

**Structural debt:**
- PENDING USER: regenerate lib/supabase/types.ts (hand-patched 0006 to
  0013); magic-link prod click-through not re-verified since 1.6;
  Baidu/Pony Q2 snapshot refresh after 2026-08-18 earnings; no
  GITHUB_DISPATCH_TOKEN, so reprocess stays disabled. 4.5 promotions were
  spot-checked and corrected 2026-08-19; city date corrections from the
  same pass are in pre-launch.md.
- `ride_count` conflates a weekly rate with a to-date total, and
  `METRIC_PROMOTION` forces the weekly reading on both; that ambiguity
  produced both errors fix(4.5) corrected. Fix is to key promotion off
  `extracted_metric.metric` and give cumulative_trips a path. Own module:
  it changes extraction behaviour.
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

- Robotaxi Tracker as corroborating signal. (State-level map fill done
  2026-08-19 as a supervision-aware tier ramp, not a density fill.)

---

## Appendix: file structure quick map

Directories only; the Routes and Components sections above enumerate what is
inside each, and repeating them here is what pushed this file over budget.

```
app/
  page.tsx, layout.tsx, globals.css   landing composition, root layout, @theme
  (public)/                  layout.tsx wraps in PageShell; milestones/,
                             methodology/, landscape/, earnings/ (4.6)
  admin/                     layout.tsx passthrough; login/; (protected)/
                             auth-gate layout + one dir per CRUD table,
                             plus earnings/ (list, [id] review queue,
                             [id]/source stored-source viewer)
  api/cron/scraper-health/   daily CPUC freshness report

components/                  sections/, charts/, ui/, operations/,
                             milestones/, landscape/, admin/

lib/
  cohorts, state-tiers (client-safe), state-fill-layer, disclosed-metrics,
  site-content, notify, last-updated,
  cpuc-calendar, landscape (server), landscape-types (client-safe),
  earnings-review (server), earnings-promote (server),
  earnings-mentions (client-safe)
  glossary/, milestones/tags, scrapers/{cpuc,cpuc-xlsx,sec-edgar,transcripts}
  extraction/{schema,text,extract,drop-log,run}
  supabase/                  server, admin, browser, types

public/                      us-states.json (51 features, ~66KB, also the
                             fixture for test-state-tiers)
supabase/                    migrations/ 0001-0013; seed.sql (6 companies)
scripts/                     run-scraper-*, run-extraction, test-*, and
                             idempotent seed-*/update-*/fix-* one-offs
.github/workflows/           scrape-{cpuc,transcripts} weekly, scrape-edgar
                             daily, extract-earnings hourly
```
