# architecture.md

Living state of the codebase, refreshed at the end of every module that
changes schema, routes, components, conventions, integrations, or debt.
Read this at the start of every planning conversation. Not the plan
(dev-plan.md), not the working agreement (CLAUDE.md): it answers "what
currently exists." Per-table schema detail lives in `schema.md`.

Accuracy beats brevity here. Past roughly 500 lines, ask what has gone
stale, not which explanation to delete: cut facts before reasons, since
a component list is re-derivable from the repo and a rationale is not.
See the architecture maintenance block in CLAUDE.md.

---

## Last updated

Module: fix(2.2) (CPUC parser for renamed files; scraper-health honesty)
Date: 2026-10-01
Commit: fix(2.2) work

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
| /earnings (4.6a, 4.6b) | intro, derived corpus strip, DisclosurePosture matrix, filterable timeline grouped by fiscal period, extraction methodology section | earnings_events, approved waymo_mentions, site_content |
| /earnings/[slug] (4.6a) | permalink: statements and table figures under separate headings, provenance block (source, model, chunks, review state). generateStaticParams over every event; 404 on unknown or colliding slug | earnings_events, approved waymo_mentions |

Not yet built: /unit-economics, /financials, /safety, /outlook.

### Admin routes

Outer `app/admin/layout.tsx` is a passthrough (keeps `/admin/login`
public); the auth gate is `app/admin/(protected)/layout.tsx` (session
check, redirect to login). All mutations use `supabaseAdmin` and
revalidate "/" at minimum (2.6); milestones also /milestones; sources
/methodology/sources; site-content /methodology(/sources); programs and
snapshots /landscape; earnings review /earnings plus
`revalidatePath("/earnings/[slug]", "page")`, since a literal path does not
cascade to a child dynamic route (4.6a).

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
| /api/og/[kind]/[id] (4.6b) | social card renderer. Takes an id, never card text: a free-text endpoint would let anyone stamp arbitrary words on the site's branding, unfixable once share URLs circulate. Node runtime (fs reads the fonts). 6.4 and 7.1 add a `kind`, not a caller |

---

## Components

### components/sections/

- **PageShell:** async server component; sticky nav and footer with
  "Last updated" from `getGlobalLastUpdated()`. Nav links only routes
  that exist (Thesis, Trajectory, Operations, Milestones, Landscape,
  Earnings; Methodology as meta-link); planned sections are added as they
  ship. Mobile renders the same list, horizontally scrollable: the old
  `slice(0, 4)` silently hid whichever section shipped last (4.6a).
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

### components/earnings/ (4.6a)

- **EventCard:** one source document on the timeline. With approved mentions:
  period, type, date, the statements-and-figures mix, two previews, permalink
  and source links, plus "review in progress" until the event settles to
  `reviewed`. Silent: a thin muted row carrying its `presence` sentence.
- **MentionQuote:** one approved quote that is genuinely prose. Serif
  blockquote, speaker as `<cite>`, mention-type chip, and a figure chip
  reading "(published)" in accent when the mention promoted. `compact` for the
  timeline, full for the permalink.
- **DisclosurePosture (4.6b):** register by fiscal quarter over every approved
  mention, as a shaded but readable `<table>` rather than a chart. Server
  component, no client JS. Counts are always printed, so shading is decorative
  and an empty quarter reads as empty. **EarningsTimeline (4.6b, client):** the
  `?q=` filter; must sit in a Suspense boundary because of `useSearchParams`.
  **TimelineGroups:** the grouped list, rendered by the server as that
  boundary's fallback and by the filter with a narrowed list, so the two
  cannot diverge.
- **TableReading:** a quote that is a row from a financial table. Leads with
  the figure from `extracted_metric`, identifies it by the table's own section
  and row labels, demotes the row as filed to an audit line. Never a
  blockquote. **Mention:** dispatches on `isTableReading()`.

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
  live in `build-log.md`; these bullets say what exists.
- **scrapers/cpuc.ts:** `runCpucScrape()` over cpuc.ca.gov quarterly zips.
  Deployment tier (2.2) upserts Waymo ride_estimates, restatements in
  place, Slack WARN past grace; pilot tier (3.4) writes per-program rows
  for `PILOT_CARRIERS` (Zoox, Nuro), DRIVERLESS data only, a miss reported
  with its reason (no folder, no driverless month-level data), never as an
  error. File choice is `pickDeploymentMonthFile()` / `pickPilotMonthFile()`
  over `isMonthLevelFile()` + `inDriverlessFolder()` (fix(2.2)), tested
  against every zip layout in `__fixtures__/cpuc-zip-listings.json`;
  `zipAvailability()` decides posted vs not. **cpuc-xlsx.ts** reads Zoox's
  pre-Q2-2026 xlsx. Non-template filers (Aurora, Tensor, WeRide, Nuro's
  Drivered workbook) out of scope.
- **cpuc-calendar.ts** also holds `classifyMissingQuarter()` (fix(2.2)):
  ingest_failing / pending / overdue / unknown, from the zip's availability
  and the calendar. scraper-health uses it.
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
  **earnings-promote.ts (fix(4.5), 4.12, server):** `decidePromotion()`
  (pure, tested) now takes an already-resolved slug and filters candidates on
  `metric`; `promoteMetric()`, `withdrawPromotion()`. Slug resolution lives in
  `resolvePromotionSlug()` (earnings-mentions.ts) so deciding WHICH quantity a
  quote describes and deciding whether that quantity is already on record are
  separate, separately tested problems.
- **earnings-card.ts (4.6b, client-safe):** `cardHeadline()` picks a social
  card's headline: prose first, then a figure rendered as a figure, then the
  presence sentence. Extracted from the route so the "a table row never
  reaches a card" rule is testable without importing next/og; a card travels
  without the page around it, so the 4.6a mistake would be worse there.
- **earnings-posture.ts (4.6b, client-safe):** collapses the 11 mention types
  to 4 registers and builds the quarter matrix; `buildPostureMatrix()`,
  `shadeStep()`. A test asserts every type in MENTION_TYPES has an explicit
  register, so a new type cannot vanish into "other". **earnings-search.ts
  (4.6b, client-safe):** `mentionHaystack()` builds the filter index from
  PRESENTED parts, never raw `quote_text`, so the synthesized bracket-and-pipe
  boundary is never matchable; plus `filterEvents()`. Tests:
  `test-earnings-posture.ts` (12), `test-earnings-search.ts` (11).
- **earnings-table.ts (4.6a, client-safe):** reads back the
  `annotateTableRows` prefix. `parseTableReading()` returns columns, section,
  row label, and regrouped cells, or null for prose; plus
  `partitionMentions()` and `describeMentionMix()`. Tests:
  `scripts/test-earnings-table.ts` (12), pinned to real Q2 2026 10-Q rows.
- **earnings-slug.ts (4.6a, client-safe):** `eventSlug()` over (company slug,
  fiscal_period, event_type), `findBySlug()` (returns collisions rather than
  picking one), and period grouping (`periodGroupKey` maps `FY 2025` to the
  `Q4 2025` group, `periodSortValue`, `periodGroupLabel`).
  **earnings-types.ts (4.6a, client-safe):** `PublicMention`,
  `PublicEarningsEvent`, `EventPresence`, `presenceFor()`, `PRESENCE_COPY`;
  same split as landscape / landscape-types. **earnings-public.ts (4.6a,
  server):** `getEarningsTimeline()`, `getEarningsEventIndex()`,
  `getEarningsEventById()`, `getEarningsEventBySlug()`, `summarizeCorpus()`.
  Whole corpus in two queries, `cache()`d so metadata and body share one read.
  Tests: `scripts/test-earnings-slug.ts` (12).
- **disclosed-metrics.ts:** reads `disclosed_metrics`.
  `getLatestDisclosedWeeklyRides()` = latest COMPANY row with source
  (hero, KeyStats; null falls back to CPUC); `getDisclosedSeries(metric)`
  = full arc, all attributions (NationalTrajectory).
- **landscape.ts (server) + landscape-types.ts (client-safe):**
  `getLandscapePrograms()` joins programs, roles, latest snapshot, source;
  `getLandscapeCities()` and `getWaymoCitiesForMap()` feed the map;
  `getCpucComparison()` builds deployment-vs-pilot series (3.4).
- **supabase/:** server.ts (session client), admin.ts (service role,
  server-only), browser.ts (anon), public.ts (4.6a: anon, cookieless, for
  public ISR reads), types.ts (generated by `supabase gen types typescript
  --linked`, regenerated through 0013 on 2026-09-30; the hand patches it
  replaced had missed `cities.service_area_geojson` and the
  `ride_estimates.program_id` Insert/Update fields).

### External integrations

| service | status | env vars | notes |
|---------|--------|---------|-------|
| Supabase | live | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | linked project, RLS enabled; Storage bucket `scraped-raw` (private) holds raw scraped CSVs; Site URL = prod Vercel URL, Redirect URLs include localhost wildcard for dev magic links |
| Mapbox | live | NEXT_PUBLIC_MAPBOX_TOKEN | CoverageMap (1.2.c) |
| Slack | live (prod) | SLACK_WEBHOOK_URL | production channel in Vercel; dev URL retained in .env.local |
| Anthropic API | live (4.4) | ANTHROPIC_API_KEY, EXTRACTION_MODEL (optional), EXTRACTION_PRICE_IN/OUT (optional) | `@anthropic-ai/sdk`, tool-use extraction, default `claude-sonnet-5` |
| Vercel Cron | live | CRON_SECRET, SCRAPER_USER_AGENT (fix(2.2), for scraper-health's HEAD to CPUC) | scraper-health daily; rotated in 1.6 |
| GitHub Actions | live | Supabase URL + service key, SCRAPER_USER_AGENT, SLACK_WEBHOOK_URL, ANTHROPIC_API_KEY | scrape-cpuc weekly Mon 13:17 UTC; scrape-edgar daily 14:07 (`since`); scrape-transcripts weekly Wed 15:11 (`from-year`); extract-earnings hourly :23 (`event`, `limit`, `include-failed`); all UTC, dispatch inputs in parens. Inputs reach the shell through env and positional args, never string interpolation |
| GitHub API | live (4.5; token set 2026-09-30) | GITHUB_DISPATCH_TOKEN, GITHUB_REPO, GITHUB_DISPATCH_REF | admin reprocess button dispatches extract-earnings.yml for one event; fine-grained PAT with Actions read and write |
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
- **The model's reading of a quote is evidence, not a draft (4.12):**
  promotion keys off `extracted_metric.metric`, with `mention_type` only as
  the fallback when the model named no quantity, because `ride_count` covers
  both "400,000 rides every week" and "4 million trips to date" and the old
  map forced the weekly reading on both. A valid slug with no
  `disclosed_metrics` home promotes nothing rather than falling back.
  Approval no longer rewrites `extracted_metric`: it previously replaced the
  object wholesale on promotion, destroying the model's slug, unit and period
  at the moment it was overruled, which is also why already-promoted rows
  cannot be re-audited. The reviewer edits the number, never the model's
  account of what it measured.
- **Scope vocabulary is aliased, not reconciled (4.12):** all 17 seeded
  `disclosed_metrics` rows carry `scope 'US'` (Waymo was US-only when those
  figures were stated) while promotion writes `'worldwide'`, so promotion
  could never match a seed: it inserted, collided on the unique
  (company_id, metric, as_of) index, and the upsert overwrote the seed's
  scope, stated_by, notes and source. Hidden until now because the four
  promotions run so far all linked to pipeline-created rows.
  `COMPANY_WIDE_SCOPES` treats the two as equivalent. EXPIRES when Waymo
  carries public riders outside the US (Tokyo), at which point the data needs
  one vocabulary rather than an alias set.
- **Metric promotion is one row per figure (fix(4.5)):** a reaffirmation
  links to the existing (company, metric, value) row and appends to its
  notes; only an unseen figure inserts, and an earlier event re-dates the
  row. Promotion is withdrawn when a mention leaves a promoting type or is
  rejected, deleting the row only if no approved mention still cites it.
  `notes` carries no ids: the `<Metric>` tooltip can surface it publicly.
- **Absence in our database is not absence at the source (fix(2.2)):** a
  freshness check that sees no row must ask the source before saying "not
  posted yet", or a broken parser reads as a slow regulator, as it did for
  25 days in 2026. And a source's "not posted" is whatever it actually
  returns: CPUC answers an unposted quarter with a 302, so every zip fetch
  uses `redirect: "manual"` and only a non-HTML 200 counts as served. A
  query error is reported as an error, never as zero rows.
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
- **Public reads use the cookieless anon client (4.6a):** `/earnings` reads
  through `lib/supabase/public.ts`. server.ts reads cookies, so an admin
  browsing a public page is authenticated against RLS and sees rows the public
  cannot, here unapproved LLM output rendering as published; it also opts the
  route out of static rendering. Mention queries filter `review_status` too,
  so leaking takes removing two guards.
- **An empty event states which empty it is (4.6a):** anon sees every
  `earnings_events` row whatever its `processing_status`, and the daily EDGAR
  action means an unreviewed filing usually exists. `presenceFor` separates
  awaiting review, no Waymo passages (`extraction_chunks = 0`), and reviewed
  with nothing approved. Rendering them alike would claim Alphabet was silent
  when nobody had looked: the 16 green CPUC no-ops again.
- **A table row is not a quotation (4.6a):** `annotateTableRows` prefixes
  rows with caption, headers, and section so the model can read bare numbers,
  and `verifyQuote` matches that prefixed text, so `quote_text` rightly stores
  scaffolding Alphabet never wrote. Published as a quote it read "[Three
  Months Ended Six Months Ended | Revenues:] Other Bets 373 382 823 793" in a
  blockquote. Public surfaces classify first: prose is quoted, table rows are
  readings led by the figure already in `extracted_metric`, row kept as an
  audit line. Stored quotes are never rewritten to read better, since a
  smoothed quote is indistinguishable from an invented one; the review queue
  keeps `quote_text` read-only for the same reason.
- **Generated images take an id, never text (4.6b):** `/api/og/[kind]/[id]`
  derives every string from the database. The shorter design,
  `/api/og?title=...`, is an open endpoint for stamping arbitrary words onto
  the site's branding, and it cannot be withdrawn once permalinks are shared.
  Fonts are vendored as woff in `app/api/og/_fonts/` because satori parses
  ttf, otf and woff but NOT woff2, and next/font/google never exposes a
  binary; both faces were verified to produce real outlines rather than
  silently falling back.
- **Permalink slugs are generated and matched, never parsed (4.6a):** derived
  from (company slug, fiscal_period, event_type), no column and no migration.
  Resolution generates slugs for every event and compares: parsing is
  ambiguous (`pony-ai` + `q1-2026` + `earnings-call` has no unique split) and
  generating detects collisions instead of picking one at random.
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
- PENDING USER: magic-link prod click-through not re-verified since 1.6.
  Resolved 2026-09-30: types.ts regenerated, Baidu/Pony Q2 snapshots added,
  duplicate SCRAPER_USER_AGENT removed from .env.local and the Actions secret
  reset to `TheEmptySeat/1.0 (getsivkyle@gmail.com)`, GITHUB_DISPATCH_TOKEN
  set in Vercel Production and the reprocess button exercised end to end
  (see Section 0 findings).
- RESOLVED 2026-09-30: `cities_count 11 @ 2026-04-29` was an ORPHAN:
  pipeline-written, company-attributed, cited by no approved mention.
  Re-cited, not deleted. The figure is real (Pichai, Q1 2026 call:
  "operations in 11 major U.S. cities in total"); its only citing mention
  (cf8a539c) had been rejected and mistyped `revenue_reference`. Retyped to
  `city_count` and approved in the admin UI; promotion linked to the existing
  row, and the audit reports 0 orphans and 0 duplicates. Original finding,
  kept for the reasoning: It is the row the
  fix(4.5) comment in earnings-promote.ts is named after. That fix added
  `withdrawPromotion` so orphans stop being created but never removed this
  one, and nothing looked again until the 4.12 audit counted rows. Harmless
  today only because nothing renders `cities_count` (only `weekly_rides` is
  consumed, by NationalTrajectory), so it becomes visible the moment anything
  does. Decide by opening the Q1 2026 call: re-cite it by approving a mention
  that states 11 cities, or delete it. Note the site's own city roster read
  11 serving-rider cities in August 2026, so 11 in April 2026 may be early.
  `scripts/audit-promotion-mapping.ts` now reports orphans on every run.
- `disclosed_metrics` has no annual-total metric, so a full-year figure has
  nowhere correct to go. The Q4 2024 Pichai quote ("more than 4 million
  passenger trips" for 2024) sits approved and unpromoted for this reason;
  the model chose `cumulative_trips` only because no period-total slug
  exists. Adding one is what would let that figure publish.
- One mention holds one metric, so a quote stating two figures publishes at
  most one. The Q4 2025 call ("surpassed 20 million fully autonomous trips
  and are now providing more than 400,000 rides every week") published the
  weekly figure and dropped the cumulative one, which is separately seeded.
- The 33 backfilled events predate the drop log, so their dropped quotes
  (5 on the Q3 2025 call among them) exist only as counts; reprocessing
  produces a log, but the model is not deterministic and may drop a
  different set. Source-viewer passage ids are re-derived by the current
  parser, so a text.ts change can shift them out of step with old locators.
- Other public routes still read through `createSupabaseServerClient()`, so
  an admin sees draft milestones on `/milestones`: the bug 4.6a fixed, lower
  stakes. Moving them to `supabase/public.ts` is a small follow-up.
- Permalink identity rests on (filer, fiscal_period, event_type) being
  unique: true for the corpus, but unconstrained. A 10-K/A or second
  item-2.02 8-K in a quarter collides; the page 404s and logs.
- 4.6 is complete. The metrics-evolution view was replaced by
  DisclosurePosture during 4.6b: 162 approved mentions carry only 4 published
  figures, so an evolution of figures had nothing to show, and the homepage
  already charts the disclosed arc from `disclosed_metrics`.
- `metadataBase` (app/layout.tsx) falls back to Vercel's production host, so
  canonical and card URLs point at `.vercel.app` until `NEXT_PUBLIC_SITE_URL`
  is set with the custom domain in 6.1 (v3). Tracked in pre-launch.md.
- The OG card has never been rendered by a real deployment; it is verified
  only by offline font parsing and headline unit tests. Confirm one card in a
  share debugger before the 7.3 announcement (v3).
- No extracted-mention total on `earnings_events` (only `extraction_chunks`
  and `mentions_dropped`), and anon sees approved mentions only, so the page
  cannot tell "extracted several, approved none" from "extracted none".
  `PRESENCE_COPY.no_approved_mentions` is true either way; a
  `mentions_extracted` column would let it say which. Scheduled as 4.14.
- `is_published` DB-level ISR trigger not wired; city detail pages not
  built; `service_area_geojson` unused. `audit_trigger_fn` hard-coded to
  `NEW.id`; non-UUID PK tables excluded.
- Planned routes not yet built: /financials, /dispatch, /safety,
  /outlook, /unit-economics; admin /admin/review, /admin/dispatch,
  /admin/subscribers (dev plan v3, Phases 5 and 6). Pre-2025 CPUC baseline and CPUC
  incident_metrics not ingested (later phases).

**Section 0 freshness findings (2026-09-30).** The repo was idle
2026-08-20 to 2026-09-30. What went stale, what was fixed, what is open:

- RESOLVED in fix(2.2), 2026-10-01: **scrape-cpuc red on all 6 runs from
  2026-08-24; CPUC Q2 2026 missing.** CPUC renames the month-level file and
  its folder almost every quarter, and the 2.2 matcher fit only Q1 2026.
  Q2 2026 is now in: Waymo deployment 4,220,075 trips (324,621/week), Zoox
  pilot 35,684 driverless trips. Nuro is not ingested: its Q2 filing is a
  Drivered, non-template per-VIN workbook (65.66 miles, 27 passengers), the
  same out-of-scope class as Aurora and Tensor, so the pilot comparison is
  Waymo vs Zoox until Nuro files driverless template data. Detail in
  build-log.md.
- RESOLVED in fix(2.2): **the alerts reached Slack; nobody acted on them,
  and the health check misdescribed the failure.** Daily WARN "OVERDUE: Q2
  2026" from 2026-09-12, so the gap was attention, not alerting. But for the
  25 days before, it posted INFO "Pending at CPUC" while CPUC was serving
  the zip, and on 2026-09-13 a failed query read as 0 quarters with every
  quarter overdue. scraper-health now asks CPUC (HEAD per missing quarter)
  and says INGEST FAILING at once when the zip is live, and a query error is
  an error-level message and a 500.
- OPEN (4.13): scrape-transcripts green on all 6 runs while logging "Alphabet
  Q2 2026: no transcript listed in sitemaps 2026-07, 2026-08" every week
  (also Q3 2024, Q1 2025). The 16-green-no-op pattern again; already scoped
  as 4.13 (the call from Alphabet IR).
- OK: scrape-edgar green on 42 runs, 26 filings known, nothing new (next
  Alphabet filing late October). Review queue: 0 pending mentions across 33
  events.
- OPEN: the Q2 2024 8-K (`ca2f6511`) is stuck at `extracted` with 1 chunk and
  0 mentions. `settleEventStatus` only runs on a review action, and an event
  with no mentions never gets one, so it reads as awaiting review publicly
  forever. Reprocessed 2026-10-01 (run 36810296472): 18/265 passages
  relevant, 1 chunk, 0 mentions, 0 dropped, so the model reads nothing
  Waymo-specific in it and re-running will not unstick it. Needs either an
  "extracted with 0 mentions settles to reviewed" rule or a manual settle
  control. Code; candidate for 4.14.
- OPEN: extract-earnings ran 336 times in ~41 days on an hourly schedule,
  about 8 a day: GitHub drops scheduled runs. Harmless while nothing is
  pending; worst case a new filing waits a few hours.
- OPEN: **an expired `ANTHROPIC_API_KEY` is invisible.** The key expired
  during the hiatus; `runExtraction` checks only that the variable exists,
  so a bad key fails inside the per-event catch, marks the event `failed`
  and leaves the run green. 336 "nothing to process" runs never called the
  model, so nothing noticed. Key rotated 2026-09-30 (Actions secret and
  .env.local) and proven by a real model call on the reprocess run
  (3,847 in / 35 out, about $0.01). Fix candidate: a one-token model call inside the credential
  check so a bad key is fatal. Code; not yet decided.
- OPEN: `weekly_rides 500000` is still linked from a REJECTED mention via
  `disclosed_metric_id` (alongside an approved one). Most likely a rejection
  that predates `withdrawPromotion`. Display is unaffected; the audit counts
  approved citations only. (`cities_count 11` had the same issue until its
  re-cite.)
- FIXED: Waymo roster, 6 cities, via `scripts/update-city-roster-2026-09.ts`.
  Houston open to all 2026-08-20; Denver, San Diego, Tampa invitation riders
  2026-09-01; Las Vegas 2026-09-14 (all now 'waitlist', launch_date = first
  public riders). San Antonio was PAUSED from about 2026-04-21 to 2026-09-17
  after a flood incident while the roster read 'waitlist' throughout:
  staleness that predates the hiatus, found only because someone looked.
  Roster checks stay manual until 5.4 (roster scraper).
- FIXED: Apollo Go and Pony.ai Q2 snapshots (2026-08-18) via
  `scripts/update-competitor-snapshots-2026-q2.ts`, re-verified against the
  releases and calls. Apollo Go Q2 weekly rides not disclosed (about 1M rides
  in the quarter, down from 3.2M) and left null by decision; Pony city count
  left null because management framed 20 cities as a year-end goal.
- OPEN: snapshot freshness. Didi (2026-04-15) is past a quarter old.
  Avride, May Mobility, Motional (2026-08-01) rest on a secondary tracker.
  Waymo One, Zoox, Tesla (2026-08-15) are inside a quarter but their content
  is behind: Waymo now 15 rider cities (snapshot 11) and ~4,000 vehicles per
  TechCrunch (snapshot 3,000); Zoox airport service; Tesla Cybercab in public
  service in Austin from 2026-09-04. The Pony Q1 row's `cities_serving_public
  20` looks overstated given the Q2 call. Apollo Go's Dubai city row says
  2026-03-30, while Robin Li dated fully driverless commercial service to
  July. All unverified against primaries; recorded, not changed.

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
                             methodology/, landscape/, earnings/ (4.6a:
                             page.tsx timeline, [slug]/ permalink).
                             financials/, outlook/, safety/ exist but are
                             EMPTY placeholder dirs, no page.tsx yet
  admin/                     layout.tsx passthrough; login/; (protected)/
                             auth-gate layout + one dir per CRUD table,
                             plus earnings/ (list, [id] review queue,
                             [id]/source stored-source viewer)
  api/cron/scraper-health/   daily CPUC freshness report
  api/og/[kind]/[id]/        social card route (4.6b); _fonts/ vendored woff

components/                  sections/, charts/, ui/, operations/,
                             milestones/, landscape/, admin/, earnings/

lib/
  cohorts, state-tiers (client-safe), state-fill-layer, disclosed-metrics,
  site-content, notify, last-updated,
  cpuc-calendar, landscape (server), landscape-types (client-safe),
  earnings-review, earnings-promote, earnings-public (server),
  earnings-mentions, earnings-slug, earnings-types, earnings-table,
  earnings-card, earnings-posture, earnings-search (client-safe)
  glossary/, milestones/tags, scrapers/{cpuc,cpuc-xlsx,sec-edgar,transcripts}
  scrapers/__fixtures__/     CPUC AV_Month and EDGAR submissions samples
  utils/                     EMPTY directory, nothing imports it
  extraction/{schema,text,extract,drop-log,run}
  supabase/                  server, admin, browser, public, types

public/                      us-states.json (51 features, ~66KB, also the
                             fixture for test-state-tiers)
supabase/                    migrations/ 0001-0013; seed.sql (6 companies)
scripts/                     run-scraper-*, run-extraction, test-*, and
                             idempotent seed-*/update-*/fix-* one-offs
.github/workflows/           scrape-{cpuc,transcripts} weekly, scrape-edgar
                             daily, extract-earnings hourly
```
