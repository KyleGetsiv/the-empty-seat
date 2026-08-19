# The Empty Seat: Development Plan v2

Revised 2026-08-15. Supersedes the v1 plan (preserved in git history; last v1 revision was commit 52adb78).

## Purpose of this document

This is the build specification for resuming The Empty Seat after a hiatus (last commit 2026-05-03). It is the source of truth for scope, sequencing, and acceptance criteria going forward. Phases 0 and 1 of the v1 plan are complete and shipped to Vercel (unannounced, behind the noindex gate); `architecture.md` is the accurate snapshot of what exists. If something here is ambiguous, surface the question rather than guessing.

Unlike v1, this is not a greenfield spec. Read `CLAUDE.md` and `architecture.md` before any module.

## What changed since v1 (project decisions, August 2026)

Three decisions reshape the plan:

1. **Scope broadens to the AV landscape, Waymo stays the flagship.** v1 was strictly Waymo-only on the public surface. Since then Zoox has begun charging the public for rides (Las Vegas, August 10, 2026, the first paid robotaxi service in the US besides Waymo), Tesla operates in seven metros (with heavy caveats), and the Chinese operators are scaling internationally. The site keeps its Waymo depth and adds a strong competitive landscape section: the "Waymo deep + landscape page" structure. No per-competitor deep pages, no company switcher.

2. **The announce bar is defined.** The site is deployed but unannounced. It goes public when three things are true: (a) nothing on the site is visibly stale, (b) the financials section with the implied Waymo P&L exists, (c) multi-operator coverage exists so the site matches its "AV deployment tracking" framing. Unit economics, safety, and outlook move post-announce.

3. **Automation is prioritized.** The owner works at an opportunistic pace with gaps between sessions. The failure mode observed in the May-August hiatus is data staleness, not missing features. Scrapers and the extraction pipeline are therefore load-bearing infrastructure, not conveniences: anything that must stay fresh quarterly should refresh itself and flag failures in Slack.

## Audience and positioning

Unchanged in substance from v1:

1. **Growth and crossover investors** evaluating Waymo (directly via secondaries, or via Alphabet) who want unit economics, implied P&L, valuation framework, and competitive positioning with primary sources linked.
2. **Operators and strategists at AV companies** benchmarking against Waymo. The landscape section now serves this segment directly rather than incidentally.

Positioning line, updated: The Empty Seat is Waymo research first, with the competitive field tracked at disclosed-data fidelity around it. Robotaxi Tracker and The Charge Port are the commodity live-dashboard layer; The Empty Seat is the research layer: sourced, editorial, and opinionated about what the numbers mean.

## Guiding principles

Principles 1 through 6 and 8 carry over from v1 verbatim (research over dashboard; primary sources always linked; tooltips everywhere; static where possible; ship vertical slices; admin UX matters; disclosed sources, not community-tracked). Principle 7 is amended:

7. **Multi-company data, Waymo-deep frontend.** Every data table keeps its `company_id` foreign key. Waymo remains the only company with full-site depth. Competitors appear in the landscape section and in explicitly comparative modules. Do not build per-company deep pages or a company switcher UI. Landscape components should render gracefully when a competitor discloses almost nothing, because most disclose almost nothing; sparse data handling is a first-class design requirement, not an edge case.

One principle is added:

9. **Confidence labeling is non-negotiable in comparative contexts.** Waymo's CPUC numbers, Zoox's CPUC pilot filings, Baidu's earnings disclosures, and Tesla's marketing claims are not the same kind of fact. Every comparative figure carries its confidence level and source type visibly, not just in a tooltip. The site's edge is that it does not launder low-quality numbers into tables next to high-quality ones.

## Tech stack

Unchanged from v1 and from `CLAUDE.md` (Next.js 16 App Router with `proxy.ts`, TypeScript, Tailwind v4 via `@theme` in `globals.css`, Recharts, Framer Motion, Vercel, Supabase, Vercel Cron plus GitHub Actions, Mapbox GL JS, Radix UI, Slack webhook monitoring). Do not substitute without asking.

Extraction model decided 2026-08-15 at Phase 4 start: `claude-sonnet-5` (Sonnet 5, $2/$10 per MTok; roughly $1-2 per quarter of Alphabet documents, ~$10 for the 8-quarter backfill). CLAUDE.md updated.

## Phase map: v1 to v2

| v2 phase | Content | v1 origin | Ships publicly |
|---|---|---|---|
| 0, 1 | Foundation; Thesis and Operations | v1 Phases 0, 1 | Done (deployed, unannounced) |
| 2 | Re-entry and freshness | New | Built 2026-08-15 (deploy; still unannounced) |
| 3 | Competitive landscape | v1 Phase 5, expanded | Built 2026-08-15 (deploy; still unannounced) |
| 4 | Financials and the extraction engine | v1 Phases 3 and 4, merged and resequenced | Yes (deploy; still unannounced) |
| 5 | Launch | v1 Phase 8 subset plus `pre-launch.md` | The announcement |
| 6 | Unit economics | v1 Phase 2 | Post-announce |
| 7 | Safety | v1 Phase 6 | Post-announce |
| 8 | Outlook, polish, distribution | v1 Phases 7 and 8 remainder | Post-announce |

v1 Phases 2 through 8 as originally written are superseded by this document. Where a v2 module says "as specified in v1", the v1 text (in git history) remains the reference for that module's detail.

Commit prefix convention continues: `feat(2.1)`, `fix(3.2)`, etc., referring to v2 phase numbers. No commits were ever made against v1 phases 2+, so there is no numbering collision.

---

## State of the world briefing (August 2026)

Research summary compiled 2026-08-15 from primary and secondary sources. This section exists so modules below can reference verified facts, and so data entry in Phases 2 and 3 starts from sourced values rather than memory. Every item here should still be re-verified against its primary source at data-entry time; items flagged UNVERIFIED must not enter the database without confirmation.

### Waymo

- Weekly paid rides: 500,000+, first disclosed ~2026-03-27, reaffirmed on the Alphabet Q1 call (2026-04-29) and again ~2026-07-08. No higher figure has been disclosed since; one analyst notes the figure has held flat across four disclosures while the city count grew, implying declining per-vehicle utilization (editorially interesting; see Phase 2.4). Target: 1M weekly rides by end of 2026.
- Cumulative paid trips: 20M+ (Electrek, 2026-07-08; single source, treat as UNVERIFIED until corroborated). Rider-only miles: 220.6M through March 2026.
- Fleet: ~3,500 to 4,000 vehicles (sources conflict; "close to 4,000" is the most recent, 2026-08-11).
- Funding: $16B round at a $126B post-money valuation, led by Alphabet, announced 2026-02-02.
- Cities serving riders (11): Phoenix, SF Bay Area, LA, Miami, Orlando, Dallas (all open access; Dallas waitlist dropped 2026-08-04), Austin and Atlanta (Uber app exclusive; exclusivity ends Jan 2028, announced 2026-07-24), Houston and San Antonio (waitlist), Nashville (public since 2026-04-07, in partnership with Lyft; open-vs-waitlist status UNVERIFIED).
- Employee-only driverless operations, public "soon" (announced 2026-07-08): Las Vegas, Denver, San Diego, Tampa.
- Announced/testing: Washington DC (delayed, regulatory limbo), Detroit, Sacramento (CPUC approval 2026-08-14 along with San Diego and enlarged Bay Area and LA territories, 18 counties), plus a long announced list (Baltimore, Boston, Charlotte, Chicago, Minneapolis, New Orleans, New York, Philadelphia, Pittsburgh, Portland, Seattle, St. Louis). International: Tokyo (testing, not serving riders), London (testing since 2026-04-14, commercial targeted 2026).
- Freeway service: launched Nov 2025 (Phoenix, SF, LA), suspended May 2026 after 13 construction-zone incidents, resumed 2026-07-29 starting with Phoenix. The June OTA fix was Waymo's sixth software recall (3,871 vehicles). Airports: SFO since 2026-01-29, Sky Harbor restored 2026-07-29.
- Uber relationship: Phoenix pilot quietly ended May 2026; Austin/Atlanta exclusivity ends Jan 2028 with Waymo launching its own app there.
- Open probes: NHTSA PE26001 and an NTSB school-bus probe (opened Jan 2026); current status UNVERIFIED.

### CPUC (the site's primary Waymo data source)

- Program active, two tracks (Deployment: Waymo; Pilot: Aurora, Tensor, Waymo, WeRide, Zoox). Most recent published quarter: Q1 2026. Q2 2026 reports were due 2026-08-01 and were not yet posted as of 2026-08-15; expect them imminently.
- Note for Phase 3: Zoox files in the CPUC Pilot Program. That is a disclosed, primary source for Zoox California activity, the same class of source the site already trusts for Waymo.

### Zoox (Amazon)

- First paid service: Las Vegas, 2026-08-10, via Zoox app, no waitlist. Preceded by ~11 months of free public rides. Geofence includes the Strip, LVCC, Sphere, T-Mobile Arena, Harry Reid airport (sq mi UNVERIFIED).
- SF: free rides, waitlist-gated (Explorers program), expanded footprint spring 2026. Paid service requires CPUC/DMV deployment permits Zoox does not yet hold. Austin: free rides operating. Miami, LA (Uber partnership, mid-2027), Dallas, Phoenix: announced/testing.
- Regulatory: NHTSA exemption granted 2026-07-30 for the purpose-built vehicle (no steering wheel), capped at 2,500 vehicles/year for two years. Fourth recall July 2026 (105 vehicles, which roughly indicates purpose-built fleet size).
- Ride volume: "350,000+ passengers" Las Vegas as of March 2026 (single source, UNVERIFIED).

### Tesla

- Operating in 7 metros: Austin, Dallas, Houston, Miami, Orlando, Tampa, SF Bay Area. The critical distinctions: the Bay Area service uses a safety driver in every car and legally is not an AV service at all (Tesla operates under a TCP charter permit; CPUC stated in March 2026 that the person in the car "is the driver"). Tesla holds no CPUC/DMV AV deployment permits and files no California AV data.
- Scale reality check: active unsupervised fleet ~21 vehicles at end of Q2 2026 per Tesla's own chart data; ~2.4-2.5M cumulative paid miles (including supervised Bay Area); Q2 paid miles roughly flat vs Q1 and declining within the quarter. Musk claims 10% weekly growth; the chart contradicts it. 380K+ cumulative unsupervised miles claimed with "0 notable incidents."
- Texas: driverless authorization under the new TxDMV framework 2026-05-28, 42 Model Ys registered (vs Waymo's 577 in Texas). Cybercab: volume production began Q2 2026, slow ramp, none in public service. Next markets named: Las Vegas, Phoenix, New Orleans. NHTSA investigation (opened June 2025) status UNVERIFIED.

### China operators

- Baidu Apollo Go: 3.2M fully driverless rides Q1 2026 (weekly peak 350K+ in March, i.e., comparable weekly volume to Waymo, at lower fares), 22M cumulative rides, 27 cities. Dubai commercial fully driverless since 2026-03-30 (with Uber and Apollo Go apps). Switzerland (AmiGo with PostBus, safety operators, June 2026), London road testing (2026-07-28), Hong Kong right-hand-drive trial, Abu Dhabi permit. RT6 vehicle cost ~$28,350. Wuhan mass outage 2026-03-31 (~100 vehicles frozen simultaneously) triggered a nationwide new-permit freeze April through late July 2026; permits resumed ~2026-07-23; Wuhan restarted with safety drivers. Q2 2026 earnings due 2026-08-18 (three days after this writing) and will show the freeze's impact.
- Pony.ai: fleet 1,700+ (May 2026), target 3,500+ by end-2026; Q1 2026 robotaxi revenue +395% YoY (small base, ~$8M); claims city-level per-vehicle unit-economics breakeven in Guangzhou (Gen-7); fully driverless commercial in all four Chinese tier-1 cities; operating in Croatia (Zagreb, billed as Europe's first commercial robotaxi), Qatar, Singapore, South Korea; announced 2,000+ robotaxis across five European cities with Uber (2026-08-14). Claims vehicle cost 1/4 to 1/5 of Waymo's. Q2 earnings due 2026-08-18.
- WeRide: Q2 2026 (reported 2026-08-12) revenue RMB 231.7M (+82% YoY), ~1,800 robotaxis domestic plus ~400 overseas, Middle East 200+; fully driverless commercial in Abu Dhabi (claims Abu Dhabi unit-economics breakeven after removing safety officers) and Dubai (via Uber, 2026-03-31); Riyadh with safety operators; committed with Uber to 1,200+ robotaxis across the Middle East; guidance: operating cash flow positive quarter in 2028, breakeven 2029.
- Didi: 24/7 driverless trials Guangzhou/Beijing, R2 vehicle 2026, UAE pilot announced; no meaningful disclosures yet.
- Market frame: Goldman ~500K robotaxis in China by 2030, ~$47B China market by 2035 (headline-level verification only).

### Nuro + Lucid + Uber (elevated to first-class operator, decision 2026-08-15)

- Structure: Nuro supplies the L4 Nuro Driver; Lucid supplies the Gravity SUV platform (later a sub-$50K "Midsize" platform); Uber owns and operates the fleet and runs the network. The only Uber AV program where Uber owns the vehicles. Uber has invested $500M in Lucid (~11.5% stake) and roughly $500M committed to Nuro (Reuters, milestone-based); vehicle commitment raised to at least 35,000 (10K Gravity + 25K Midsize) on 2026-04-14.
- Status: ~100 Gravity engineering vehicles testing autonomously with safety operators in the SF Bay Area (since Dec 2025) and Houston (confirmed 2026-06-17). Uber employees hailing them via the Uber app since 2026-04-13. No public rides, no fares. Driverless testing not yet begun as of June reporting. Production Gravity units began shipping from Lucid's Arizona plant July 2026. Lucid (2026-08-04) and Uber (2026-08-05) both reiterated a late-2026 Bay Area launch; Houston mid-2027 with a 50K sq ft depot.
- Regulatory: CA DMV driverless testing permit adds Gravity (April 2026; Santa Clara and San Mateo counties, up to 45 mph, NOT San Francisco proper); CPUC Drivered Pilot permit 2026-05-08 (passengers with safety driver, no fares); 47 vehicles registered in Texas. Will appear in CPUC Pilot Program quarterly filings from Q2 2026, joining Zoox in the site's regulatory comparison frame. Still needs CPUC driverless/deployment and DMV passenger deployment permits before charging fares.
- Disclosed metrics: fleet ~100 (unchanged since March 2026); no miles or ride counts disclosed. Nuro: $203M Series E at $6B (Aug 2025), pivoted from delivery to licensing Sept 2024, co-CEOs Zhu and Ferguson.
- What the sensor-halo Lucid SUVs seen around SF with a driver are: this engineering fleet, in autonomous mode with a safety operator, day and night.

### Other US operators (for landscape completeness)

- Avride: commercial in Dallas on Uber app since Dec 2025, safety operator onboard. May Mobility: driver-out low-speed service Atlanta metro; Arlington TX on Uber. Motional: supervised Las Vegas pilot on Uber, driverless targeted end-2026. Cruise: still dead (shut down Dec 2024). Uber is the common rail for nearly every non-Waymo operator (30+ AV partnerships, AV live in 7 cities, 15 targeted by end-2026, "hundreds of thousands" of AV trips per week per the Q2 2026 call); Lyft has Waymo (Nashville) and Freenow/Baidu in Europe.

### Alphabet financials (for Phase 4)

- Q1 2026 (reported 2026-04-29): Other Bets revenue $411M (down YoY from $450M), operating loss $2.1B (widened from $1.22B). Pichai confirmed 500K+ weekly Waymo rides on the call.
- Q2 2026 (reported 2026-07-22): Other Bets revenue $382M (vs $373M), operating loss $1.8B (vs $1.24B). Waymo commentary on the Q2 call UNVERIFIED (transcript not yet reviewed; do so in Phase 4.7 backfill).

---

## Phase 2: Re-entry and freshness

**Ships publicly**: yes (deploys to the live but unannounced site).

**Goal**: nothing on the site is stale or broken. The scraper pipeline is verified healthy. The database reflects August 2026 reality. This phase is deliberately unglamorous; it is the precondition for everything else.

### 2.1 Repo, pipeline, and database audit

**Background**: the August 2026 planning session could not reach the Supabase project or GitHub Actions history from its sandbox, so the actual state of the data pipeline is unknown. The scraper has theoretically been running weekly since May.

**Do**:
- Run the repo locally: `npm install`, `npm run build`, `npm run lint`. Note any dependency warnings; do not upgrade majors without surfacing.
- Check GitHub Actions history for `scrape-cpuc.yml`: has it run weekly since May? Any failures? Did failures reach Slack?
- Query the database and record: which CPUC quarters exist in `ride_estimates` (specifically, did Q1 2026 land after its ~May publication?), latest `milestones` entry, current `cities` rows and statuses, content of `latest_weekly_rides_disclosed`, row counts per table.
- Verify the Robotaxi Tracker JSON mirror (`/data/cpuc-waymo-deployment-YYYY.json`) still exists and serves 2026 data; the CPUC scraper depends on it. If the mirror is gone or stale, this becomes the first surfaced decision of the resumption (fallback: scrape CPUC's published spreadsheets directly; that is a bigger lift and needs its own module).
- Verify Supabase project health (not paused; magic link login still works locally), Slack webhook fires, Vercel deployment still builds from main.
- Write findings into a short dated section in `architecture.md` under Known gaps and debt, then propose the fix list for the rest of Phase 2 based on what is actually broken vs. the assumptions in this plan.

**Acceptance**: a written audit summary exists; the user has approved the adjusted Phase 2 scope. (Completed 2026-08-15; findings recorded in architecture.md. Modules 2.2, 2.3, and 2.6 reflect the audit results.)

### 2.2 CPUC scraper rebuild (direct) and catch-up

**Background, from the 2026-08-15 audit**: Robotaxi Tracker's JSON mirror is gone; its `/data/*.json` paths now serve the site homepage. The scraper treated the resulting 404s as routine skips, so all 16 GitHub Actions runs since May reported success while ingesting nothing. The database holds Q1-Q4 2025 only; Q1 2026 (published by CPUC in May) never landed. Decision made 2026-08-15: keep the CPUC series and rebuild the scraper against CPUC's own published files.

**Do**:
- Investigate what CPUC actually publishes (file format, URL stability, per-quarter vs cumulative structure) and propose the parsing approach before writing code.
- Rewrite `lib/scrapers/cpuc.ts` to fetch from cpuc.ca.gov directly. Keep the existing upsert/restatement logic, source rows, and etiquette (robots.txt, `SCRAPER_USER_AGENT`, 2s delays). Store raw fetched files in Supabase Storage per the scraper rules.
- Fix the failure semantics that made the outage silent: once a quarter is more than ~6 weeks overdue relative to CPUC's publication calendar (May 1 / Aug 1 / Nov 1 / Feb 1 deadlines), a run that finds nothing new posts a Slack WARN, not a quiet success. Success messages include which quarters exist in the database.
- Wire `/api/cron/scraper-health` to do its actual job: it still says "no scrapers configured yet". It should report the age of the latest CPUC quarter and the last successful scrape run.
- Delete the stray `ride_estimates` row (period 2026-03-21 to 2026-03-27, rides_per_week 500000): it is a disclosed-metrics value mis-entered as a CPUC-style row, and it corrupts the quarterly chart (bogus 6.5M "Q1 2026" point) and the KeyStats cumulative tiles.
- Backfill Q1 2026 and, once published, Q2 2026 (due 2026-08-01, expected imminently).
- `QuarterlyTripsChart` renders multi-year data correctly (X-axis labels, QoQ across the year boundary) and its as-of footnote derives from data rather than hardcoded copy.

**Acceptance**: scraper runs green in GitHub Actions against the real CPUC source; Q1 2026 (and Q2 if available) in the database and on the chart; the stray row is gone; a simulated missing-quarter scenario produces a Slack WARN; health cron reports real scraper state.

### 2.3 National disclosed-metrics series

**Background**: decision made 2026-08-15. The site's headline quantitative story should be national/global, not CA-only. Waymo's disclosed worldwide weekly-rides arc (100K -> 250K -> 500K -> the stated 1M end-2026 target) becomes a first-class time series now, rather than waiting for the Phase 4 extraction pipeline. Phase 4 later feeds this table automatically; Waymo's own blog/newsroom is where most disclosures actually break, so a lightweight monitor for it is part of Phase 4's scope.

**Do**:
- New migration (show SQL before applying): `disclosed_metrics` table. Proposed shape: `id` uuid pk, `company_id` fk, `metric` text (e.g. 'weekly_rides', 'cumulative_trips', 'fleet_size', 'cities_count'), `value` numeric, `as_of` date, `scope` text default 'worldwide', `source_id` fk (required in practice), `stated_by` text nullable (e.g. 'Waymo blog', 'Alphabet Q1 2026 call'), `notes` text, `created_at`. UUID pk keeps the audit trigger compatible.
- Migrate the `latest_weekly_rides_disclosed` site_content row into the table; rewrite `lib/disclosed-metrics.ts` to query the table (latest row per metric) instead of parsing YAML-ish site_content text; retire the fragile text format and its fix-up scripts. ThesisHero and KeyStats keep their current prefer-disclosed behavior unchanged.
- Seed the weekly-rides disclosure arc by hand with source rows (the ~100K, 250K, 500K disclosures and dates; re-verify each against its primary source at entry).
- Build the headline national chart on the landing page: disclosed weekly rides over time (stepped line or dot-per-disclosure; disclosures are episodic, and the chart should be honest about that), with the 1M end-2026 target rendered as an annotation, not a data point. Editorial framing paragraph; the flat-500K observation belongs here if the user approves that copy.
- Admin CRUD for `disclosed_metrics` following the existing pattern.

**Acceptance**: migration reviewed and applied; table seeded with sourced arc; national chart renders on the landing page above the CA section; hero and KeyStats read from the new table; admin can add a future disclosure end to end.

### 2.4 Waymo city roster and status refresh

**Background**: the `cities` table has 11 rows with statuses as of ~April 2026. Reality as of August: see the briefing above. New cities exist in every status, and the current status enum ('announced' | 'waitlist' | 'public' | 'paused') has no value for "driverless operations, employee-only, public soon" (Las Vegas, Denver, San Diego, Tampa).

**Do**:
- Surface the status-modeling decision before any migration: either (a) add an 'employee' status value via migration, or (b) map employee-only cities to 'announced' with a note. Recommendation: (a); the distinction is analytically meaningful (driverless ops running vs. paper announcement) and the timeline UI can style it. User decides.
- Update all existing city rows to August 2026 statuses (Dallas open, Miami/Orlando open, Nashville public, Houston/San Antonio waitlist, etc.) with source rows for each change.
- Add new rows: the four employee-only cities, Sacramento, Detroit, Washington DC, and (decision to surface) whether to include the full announced list and international testing cities (Tokyo, London) or hold those for a milestone-only treatment. Recommendation: include announced cities sparingly (only where Waymo has named a timeframe or begun operations) so the map and timeline stay signal-dense.
- Update `service_area_sq_mi` where new figures are disclosed (CPUC's 2026-08-14 territory expansion is a source for CA).
- Verify the coverage map and city timeline render the updated roster well at the new city count (~15-18 rows; the accordion and map were designed at 11).

**Acceptance**: cities table matches verified August 2026 reality with sources; timeline and map render cleanly; status decision documented in `architecture.md`.

### 2.5 Milestones backfill

**Do**:
- Backfill milestones for May through August 2026, each with a source row and (optionally) a `kyle_annotation`. Candidates from the briefing: freeway suspension (May) and resumption (2026-07-29); sixth recall (June); Uber-Waymo Phoenix pilot ending (May/June); Austin/Atlanta exclusivity unwind announcement (2026-07-24); Dallas open access (2026-08-04); CPUC Sacramento/San Diego approval (2026-08-14); Las Vegas Raiders partnership (2026-08-13); the four-city employee-driverless announcement (2026-07-08). The $16B raise (2026-02-02) and the 500K milestone are already present from the earlier seed (verified in the 2026-08-15 audit).
- Editorial note for the thesis/hero copy: the flat-500K-across-disclosures observation (rides held steady while cities grew from 10 to 15) is exactly the kind of insight this site exists to surface. Draft a short thesis-section update for user review; do not publish without approval since it is an analytical claim.
- Add a `fleet_snapshots` row for the ~3,500-4,000 figure only if a citable primary source is found; the current sources conflict.

**Acceptance**: milestones feed reads as current through August 2026; no UNVERIFIED briefing item entered the database.

### 2.6 Debt paydown (announce-visible only)

**Do**, from the `architecture.md` debt list plus the 2026-08-15 audit findings, only the items a visitor or admin would hit:
- Fix the KeyStats year-scoping bug: the "Trips in 2025 (CA)" and "Miles driven 2025 (CA)" tiles sum every quarter in the table regardless of year. Scope the sums to the most recent complete calendar year and derive the label from data. Same fix for the QuarterlyTripsChart framing sentence ("completed X trips in California in 2025" currently sums all points).
- Remove hardcoded staleness-prone copy: "filed February 2026" (KeyStats tooltip and chart footnote), "2026 figures expected May 2026 onward". Derive from data or drop.
- Fix status badges: `CityLaunchTimeline` and the CoverageMap popup collapse 'waitlist' into "Announced". Render all statuses distinctly (matters more once the status model expands in 2.4).
- Fix the broken delete confirmation on `companies/[id]` (server-form `confirm()` bug); apply the same pattern check to all other delete forms.
- Add missing `revalidatePath` calls to fleet-snapshots, ride-estimates, and financial-periods mutations (they will matter once landscape and financials pages read those tables).
- Regenerate `lib/supabase/types.ts` properly for the migrations landed in 2.3/2.4 (and retire the manual patches).
- Magic-link login click-through retest against prod (deferred from 1.6).
- Explicitly deferred: `site_content` YAML textarea hardening, audit trigger generalization, city detail pages, `service_area_geojson` polygons.

**Acceptance**: listed fixes verified (delete confirm in a real browser per the working agreement); deferred list re-recorded in `architecture.md`.

### 2.7 CLAUDE.md and architecture.md revision

**Do**:
- Propose a `CLAUDE.md` edit set for user approval: amend the "multi-company data, Waymo-only frontend" architecture principle to the v2 principle 7 wording; add a "Phase 2 status" section on completion; note the extraction-model decision as pending Phase 4; update the First session section to point at this plan.
- Update `architecture.md` per the standard maintenance block (this phase touched schema, data, and components).

**Acceptance**: user approved the CLAUDE.md diff; both files committed with the module work.

---

## Phase 3: Competitive landscape

**Ships publicly**: yes (deployed; announcement still held for Phase 5).

**Goal**: `/landscape` becomes the best sourced, most honest single page on the internet about who is actually operating robotaxis, at what scale, with what disclosure quality. This is the phase that makes the site match its "AV deployment tracking" ambition.

### 3.1 Operator data model

**Do**:
- Show migration SQL before applying (working agreement). Proposed additions:

```
competitor_snapshots
  id uuid pk
  company_id uuid fk -> companies
  snapshot_date date
  cities_served int                    nullable
  vehicle_count int                    nullable
  weekly_rides int                     nullable
  cumulative_rides numeric             nullable
  autonomous_miles_cumulative numeric  nullable
  funding_total_usd numeric            nullable
  implied_valuation_usd numeric        nullable
  supervision text                     'driverless' | 'safety_operator' | 'mixed' | 'safety_driver_legal_driver'
  disclosure_quality text              'regulatory' | 'company_disclosed' | 'earnings_disclosed' | 'press_reported' | 'estimated'
  source_id uuid fk -> sources         required in practice; enforce in admin UI
  notes text
  created_at
```

- Every column nullable by design (principle 7: sparse data is normal). `disclosure_quality` implements principle 9 at the schema level.
- **Operator roles (added 2026-08-15 for Nuro/Lucid/Uber).** A "deployment" is not always one company. Nuro (driver), Lucid (vehicle), and Uber (fleet owner and network) jointly form one operator; Waymo rides in Austin run on Uber's network; Apollo Go rides in Dubai run on Uber's app. Model this with an `operator_programs` table (one row per deployment program, e.g. 'Uber premium robotaxi', 'Waymo One', 'Zoox') and an `operator_program_roles` join (program_id, company_id, role in 'av_developer' | 'vehicle_platform' | 'fleet_operator' | 'network'). `competitor_snapshots` and competitor `cities` rows key on the program, not the company, so the landscape table has one row per thing-on-the-road. Single-company programs (Waymo, Zoox, Tesla, Apollo Go) simply hold all roles. Show the SQL for approval; this supersedes the company-only shape above.
- Extend `companies` with `hq_country text`, `ownership text` (e.g., 'Amazon subsidiary', 'Nasdaq: PONY'), `status_summary text` (one editorial sentence, admin-maintained). Add company rows: Nuro, Lucid, Uber, Avride, May Mobility, Motional, Didi (decision 2026-08-15: include the minor operators; rows are cheap and the table filters).
- The `cities` table already supports non-Waymo rows via `company_id`; add a nullable `program_id` for the same reason. Enter competitor cities (Zoox Las Vegas/SF/Austin, Tesla's seven metros, Nuro/Lucid/Uber Bay Area and Houston, Apollo Go Dubai, WeRide Abu Dhabi/Dubai, Pony Zagreb, etc.) with correct statuses; the Waymo-only queries on existing pages already filter by company and are unaffected (verify).
- Admin CRUD for programs, roles, and `competitor_snapshots` following the existing admin page pattern.

**Acceptance**: migration reviewed and applied; admin can enter a full competitor snapshot with source; existing Waymo pages unaffected (verified in browser).

### 3.2 Sourced data entry

**Do**:
- Enter initial snapshots for Waymo, Zoox, Tesla, Nuro/Lucid/Uber, Baidu Apollo Go, Pony.ai, WeRide, plus the minor US operators, using the State of the world briefing as the checklist but re-verifying each figure against its primary source at entry time. UNVERIFIED items stay out.
- Timing note: Baidu and Pony.ai report Q2 2026 earnings on 2026-08-18. Module 3.2 ran 2026-08-15 with Q1 2026 figures for both. **TODO after 2026-08-18: add a fresh snapshot row for `apollo-go` and `pony-ai` via /admin/snapshots (or extend the seed script) with Q2 numbers, and check whether the Wuhan outage and permit freeze dented Apollo Go's Q2 ride volume.**
- Every snapshot row carries `disclosure_quality` honestly: Tesla's "7 metros" is company_disclosed; its ~21-car unsupervised fleet is press_reported (derived from Tesla's own chart by analysts); Waymo CPUC trips are regulatory.

**Acceptance**: at least one complete, sourced snapshot per major operator; spot-check that every row's source URL resolves. (Done 2026-08-15: 11 snapshots, 30 competitor city rows via `scripts/seed-competitor-snapshots.ts`.)

### 3.3 Landscape page

**Do**:
- Build `/app/(public)/landscape/page.tsx` inside the existing `(public)` layout pattern. Structure, top to bottom:
  1. **Editorial opening** (site_content key `landscape_intro`, admin-editable): the state of the race in three paragraphs. Draft placeholder copy marked `// TODO: user to replace with final copy`.
  2. **The comparison table** (`components/sections/OperatorTable.tsx`): operators as rows (not columns; the operator count now exceeds the horizontal budget). Columns: operator, ownership, cities serving riders, supervision status, fleet, weekly or cumulative rides, latest disclosed valuation/funding, disclosure quality badge. Every cell an as-of date; empty cells render as "not disclosed" rather than blank (the emptiness is information).
  3. **Supervision-status framing module**: a visual strip separating "driverless, paid, public" (Waymo, Zoox Vegas, Apollo Go, Pony, WeRide in specific cities) from "supervised or legally-a-driver" (Tesla Bay Area, Riyadh operators, etc.). This is the page's core editorial argument rendered as UI.
  4. **US deployment map**: extend `CoverageMap` with a landscape variant showing multi-operator city markers (distinct marker style per operator, no service-area polygons for non-Waymo operators since areas are mostly undisclosed). Surface before building if this should instead be a separate lighter component; reuse is preferred but not at the cost of complicating the Waymo map.
  5. **China and international section**: prose plus a compact static table (the v1 5.4 module, upgraded with the now-substantial international expansion: Dubai, Abu Dhabi, Zagreb, Switzerland). Editorial framing: what Apollo Go's 350K weekly rides at ~$28K vehicle cost implies for the US cost curve.
  6. **Methodology footnote**: disclosure-quality taxonomy explained; links to CPUC, SEC, earnings sources; explicit statement of what the site refuses to guess.
- Add Landscape to the global nav (it exists in the v1 nav spec but verify it is present and points here).
- Tooltips and `<Term>` usage throughout; add glossary entries as needed (candidate terms: supervision levels, TCP permit, NHTSA exemption, Standing General Order).

**Acceptance**: page renders with real entered data; sparse cells degrade gracefully; mobile responsive; nav link live; browser-verified.

### 3.4 Disclosed-data comparison: Waymo vs. Zoox (and Nuro) via CPUC

**Background**: v1 planned a Waymo vs. Tesla disclosed-data comparison and told us to re-investigate at planning time. Investigated: Tesla still files no California AV data (TCP permit, not an AV deployment permit), so no honest disclosed-data comparison with Tesla exists. Zoox files in the CPUC Pilot Program, and Nuro joins it from Q2 2026 (Drivered Pilot permit 2026-05-08): same regulator, same cadence as the site's primary Waymo source. Confirmed in 2.2 that CPUC's pilot zips (`av-pilot-YYYYqQ.zip`) use the same CSV layout as the deployment zips, so the 2.2 parser applies.

**Do**:
- Extend `lib/scrapers/cpuc.ts` to also fetch the Pilot Program zip each quarter and ingest per-carrier monthly rollups for Zoox and Nuro (and Waymo's own pilot-tier data if present) into `ride_estimates` keyed by program, `confidence 'high'`, with a methodology note distinguishing pilot from deployment tiers.
- Build a modest comparison chart on the landscape page: Waymo deployment trips vs. Zoox pilot trips, CA only, log scale or dual annotation (the gap is orders of magnitude; the chart's honesty about that gap is the point).
- Tesla gets a prose treatment instead: a short sourced sidebar on why Tesla does not appear in disclosed-data comparisons (no CPUC AV filings; the CPUC "is the driver" statement). This is more credible than a mixed-confidence chart, and more interesting.

**Acceptance**: comparison renders from disclosed data only; Tesla sidebar sourced; methodology tooltip complete. (Built 2026-08-15: migration 0011, pilot ingestion with xlsx reader, CpucComparisonChart, regulatory section with Tesla sidebar. Zoox Q1 2026 pilot: 23,068 driverless trips, doubling month over month.)

### 3.5 Ship checkpoint

**Do**: deploy, verify all Phase 3 acceptance criteria, update `architecture.md` and `pre-launch.md`, notify user for review. No announcement.

(Done 2026-08-15: nav trimmed to routes that exist (Trajectory added, five unbuilt sections removed until they ship); pre-launch.md gains placeholder-copy sweep, snapshot freshness, and types regeneration items. Phase 3 is code-complete pending the user's local steps: push, `supabase db push` for 0010 and 0011, run the three seed scripts and the scraper (which now also backfills Zoox pilot quarters), regenerate types.)

---

## Phase 4: Financials and the extraction engine

**Ships publicly**: yes (deployed; announcement held for Phase 5).

**Goal**: the implied Waymo P&L (the artifact an investor screenshots for an IC memo) built on top of an automated earnings-extraction pipeline, so the financial picture refreshes itself each quarter instead of rotting between sessions. This merges v1 Phases 3 and 4 and reverses their order: pipeline first, P&L on top.

**Sequencing note**: v1 derived implied-P&L COGS from the unit economics assumptions table, which now ships post-announce (Phase 6). The v2 implied P&L therefore ships as v1: revenue build from disclosed rides and modeled fare, opex allocated from Other Bets, capex modeled, with gross-margin decomposition explicitly marked "arrives with the unit economics module." When Phase 6 ships, the P&L upgrades in place. This dependency is deliberate and documented in the P&L's methodology tooltip from day one.

### 4.1 Data model

As specified in v1 4.1 with two changes: `earnings_events.event_type` gains 'shareholder_letter', and the v1 `extracted_metrics` table is dropped in favor of the existing `disclosed_metrics` table (2.3): approving a metric-type mention in the review queue promotes it to a `disclosed_metrics` row with `attribution 'company'` and links back via `waymo_mentions.disclosed_metric_id`. Show full migration SQL before applying.

(Built 2026-08-15: migration 0012, types, `/admin/earnings` events list and `/admin/earnings/[id]` review queue with approve/reject/edit, bulk approve, and metric promotion for ride_count -> weekly_rides, city_count -> cities_count, fleet_size -> fleet_size. Model decision recorded in CLAUDE.md.)

### 4.2 SEC EDGAR scraper

As specified in v1 4.2 (`lib/scrapers/sec-edgar.ts`, daily GitHub Action, Alphabet CIK 0001652044, 10-K/10-Q/8-K detection by accession number, raw filings to Supabase Storage, `pending` status rows, SEC fair-use etiquette).

(Built 2026-08-15. Design notes from investigating the live API: 8-Ks are filtered to item 2.02 (earnings releases) since Alphabet files many governance 8-Ks; the EX-99.1 press-release exhibit is fetched alongside the primary doc because that is where the numbers live; 8-K fiscal period is the quarter before the release date. Verified at the primary source that Alphabet's Q2 2026 earnings release contains zero Waymo mentions (Other Bets revenue $382M, operating loss $1.8B), so the pipeline's honest output for that event is "0 mentions". Alphabet added as a companies row (filer). Daily action `scrape-edgar.yml`, 6 fixture tests.)

### 4.3 Earnings call transcript scraper

As specified in v1 4.3, with a pre-build check: verify Motley Fool transcripts remain accessible and robots.txt-permitted in August 2026; if not, surface alternatives (Seeking Alpha is generally paywalled; Alphabet's own IR site posts webcast transcripts/prepared remarks) before writing any scraper.

(Built 2026-08-15. Pre-build check passed: fool.com robots.txt permits `/earnings/call-transcripts/` and the Q1 2026 Alphabet transcript renders as plain HTML. Discovery reads Fool's monthly sitemaps (listed in robots.txt) for the two months after each quarter end and matches `/earnings/call-transcripts/YYYY/MM/DD/alphabet-{googl|goog}-qN-YYYY-earnings-call-transcript/`, skipping quarters already in `earnings_events`. (First version probed candidate dates directly; the first live run on 2026-08-15 tripped Fool's rate limiter with a 429 and blocked page, so that approach was replaced the same day. Also found on that run: pre-2025 transcripts use the classic layout with bold speaker header paragraphs, and some quarters are filed under the GOOG ticker; both handled.) Body parsing handles both layouts and groups paragraphs into speaker turns. Raw page plus turns.json to Storage; weekly action `scrape-transcripts.yml`; 9 parser tests. If Fool changes its URL pattern or moves transcripts behind a wall, the weekly run reports 0 found and the health check will surface the staleness.)

### 4.4 Extraction pipeline

As specified in v1 4.4 (chunking, structured extraction to the `waymo_mentions` schema, Zod validation, `extraction_version`, hourly cron), with two updates:
- Model: use the model chosen in the Phase 4 model decision (see Tech stack section above), not the hardcoded April 2026 string.
- Add per-event cost logging (tokens in/out) to the Slack success notification, so pipeline economics are visible from the first run.

(Built 2026-08-15: `lib/extraction/` (schema, text, extract, run), migration 0013 (per-event tokens, chunk count, dropped-quote count), `scripts/run-extraction.ts`, hourly action `extract-earnings.yml`, 9 offline tests with an injected fake model. Design notes: passages are labelled and pre-filtered to those mentioning Waymo or Other Bets plus one neighbour, so a filing with no Waymo text (Q2 2026 8-K) is marked extracted with 0 mentions and 0 model calls; the model returns quotes via forced tool use and every quote is verified verbatim (normalised for curly quotes and dashes) against the passage it cites before it is stored, unverifiable ones are counted and dropped; speaker names come from the transcript turn, not the model. Runs on GitHub Actions rather than Vercel Cron because Hobby crons are daily-only and a 10-K may need many model calls. Cost shown as an estimate from configurable per-token prices; the first real run is the calibration. Follow-up the same day after the first dry run: financial table rows are prefixed with the table caption, header rows, and section label so "Other Bets 450 411" reads as "[Segment results (in millions) Quarter Ended March 31, 2025 2026 | Revenues:] Other Bets 450 411"; quote minimum lowered to 10 characters so a table row can be quoted whole. First live results, Q1 2026 8-K and call: 6 and 5 mentions, 0 unverified, about $0.03 and $0.06; the 8-K repeats its segment table so identical metric/value/period mentions are now deduplicated within an event. Backfill of the other 31 events: 26 clean, about $1.30 total; the 5 failures were all-or-nothing validation on one malformed mention (stringified array, invented metric slug, sub-10-char quote), so validation is now per mention with shape repair (`coerceExtractionOutput`) and individual drops.)

### 4.5 Admin review queue

As specified in v1 4.5. Nothing extracted is public until approved; this is the existing `pending_review` etiquette applied to LLM output.

(Built 2026-08-15, scope agreed at the end of the 4.4 session: filters and a next-unreviewed jump on the events list, a mention status filter on the review page, a needs-a-number prompt, a link from each mention to the stored source at its cited passage, a per-event dropped-quotes log, and a reprocess button. No migration. Design notes: the drop log needed somewhere to live, because 4.4 stored only a count and discarded the quotes themselves. Extraction now writes `scraped-raw/extraction-logs/{event_id}/v{version}.json` holding each dropped quote with its reason ('invalid_schema' or 'unverified', which 4.4 conflated under one counter), chunk, and cited locator; Storage rather than a column keeps the module migration-free, and the log is written even when nothing was dropped, so a missing log means "extracted before 4.5" rather than "lost nothing". The 33 backfilled events therefore have counts but no quotes, the 5 on the Q3 2025 call among them; reprocessing produces a log, but the model is not deterministic and a re-run may drop a different set. The needs-a-number guard disables Approve on a metric-type mention with no value until a number is entered or "approve without promoting a number" is ticked, and bulk approve leaves those mentions pending rather than approving something that can never promote; bulk approve also promotes metrics now, which it previously skipped silently. Reprocess dispatches extract-earnings.yml through a new `event` input rather than calling the model inside a Vercel function, which a multi-chunk 10-K would outrun: it needs GITHUB_DISPATCH_TOKEN and renders disabled without one. The stored-source viewer re-derives passages with the extraction parser, so ids match stored locators as long as text.ts does not change. architecture.md hit its 500-line ceiling during this module; the scraper and extraction bullets in Libraries were compressed to what exists, with the how-it-got-built detail left here.)

### 4.6 Public earnings section

As specified in v1 4.6 (`/earnings` timeline of events with approved mentions, metrics-evolution view, full-text search, per-event permalinks with OG images).

**Split into 4.6a and 4.6b** (agreed 2026-08-16): five deliverables is too large for one browser-verifiable commit.

- **4.6a**: `/earnings` timeline, per-event permalinks, extraction methodology copy, nav link, revalidation wiring.
- **4.6b**: metrics-evolution view, verbatim search, shared OG route.

Scope decisions taken at planning time:
- **Search is a client-side filter**, not a Postgres tsvector migration. The corpus is 33 events and 162 approved mentions, all of which fit in one ISR payload. Revisit past a few thousand mentions.
- **Permalinks derive their slug** from `fiscal_period` + `event_type` (`alphabet-q1-2026-earnings-call`) and resolve by lookup on those columns. No slug column, no migration. Assumes uniqueness per (period, type).
- **Events with zero approved mentions render as thin muted rows** ("no Waymo mentions") rather than being hidden. A quarter where Alphabet said nothing about Waymo is a finding, and showing them proves the pipeline is not cherry-picking. The Q2 2026 8-K is the honest example.
- **The metrics-evolution view must not redraw the homepage arc.** `NationalTrajectory` already plots `disclosed_metrics` weekly rides. The earnings view reads `waymo_mentions` instead, including mentions that never promoted: it answers "when was this said, by whom, in what words", not "how many rides".
- **Multi-source citation uses the existing `waymo_mentions.disclosed_metric_id` back-link**, queried from the mentions side. One `disclosed_metrics` row keeps one primary `source_id`; no join table, no migration.
- **The shared `/api/og` route is built in 4.6b**, not deferred to Phase 5.1. Permalinks are the shareable artifact, so 4.6 needs it and 5.1 extends it to the other five surfaces.

**Blocked by**: `fix(4.5)`. The 4.5 review pass promoted six `disclosed_metrics` rows, four of which were wrong (see that commit). 4.6a publishes those figures beside named-executive quotes, so it starts from corrected data.

### 4.7 Backfill

Run the backfill script for the last 8 quarters of Alphabet filings and calls (Q3 2024 through Q2 2026). This closes the UNVERIFIED item from the briefing (what was said about Waymo on the Q2 2026 call) and seeds the metrics-evolution view with the 100K -> 250K -> 500K weekly-rides disclosure arc.

(Run 2026-08-15, ahead of order, as the first live use of 4.4: 26 SEC filings (Q2 2023 through Q2 2026) and 7 Motley Fool transcripts (Q1 2024, Q2 2024, Q4 2024, Q2 2025 through Q1 2026) extracted, 33 events total, about $1.50 in model cost. Fool did not publish Alphabet transcripts for Q3 2024 or Q2 2026; the Q2 2026 call is available from Alphabet IR (abc.xyz) and is the remaining gap for the UNVERIFIED item. All mentions are pending review; the highest-value approvals are the metric mentions in the 8-Ks and calls, which promote to disclosed_metrics.)

### 4.8 Other Bets walk

As specified in v1 3.1: admin entry for Other Bets quarterly figures (the briefing has Q1/Q2 2026; backfill earlier quarters from filings ingested in 4.7), `OtherBetsWalk` chart separating the user-estimated Waymo share with explicit estimate labeling.

### 4.9 Implied Waymo standalone P&L

As specified in v1 3.2 (`implied_pnl_periods` table, weekly recompute cron for unlocked periods, table view with disclosed-vs-modeled columns, CSV export, admin lock/override), minus the unit-economics COGS derivation per the sequencing note above. Methodology strings must state the v1 simplification plainly.

### 4.10 Financials landing page and ship checkpoint

Build `/financials` as the container (v1 3.5 layout: editorial opening, sticky scroll nav, sections stacked); capex intensity chart (v1 3.3) if data supports it, else defer to Phase 6; deploy; verify; update `architecture.md` and `pre-launch.md`; notify user. The valuation framework (v1 3.4) moves to Phase 8 with the outlook work, where its scenario presets belong.

### 4.11 Waymo site roster scraper

**Background**: the failure mode observed in the May-August hiatus is staleness, and the city roster is the most visible thing that rots. Spot-checked 2026-08-16 against waymo.com: membership was exactly right (the 11 serving-rider cities matched the table's 9 public + 2 waitlist), but Nashville's `public_access_date` was wrong by two and a half months, and Los Angeles collapses a waitlist period into a single date.

**Constraint found while investigating**: waymo.com sorts cities into only two buckets, "Serving Riders In" and "Up Next". It cannot distinguish `public` from `waitlist`, and it cannot distinguish `employee` from `announced`: Las Vegas, Denver, San Diego and Tampa sit under "Up Next" beside Seattle and Tokyo. This scraper therefore maintains **membership, not status**. Status changes still need a human, sourced from the Waymo blog or the support pages (the Nashville open-to-everyone date came from `support.google.com/waymo`, not the marketing site).

**Do**:
- robots.txt pre-check first and surface the result before any parser is written, as 4.3 did for Motley Fool.
- Parse the location lists into the two buckets; match against `cities` by name, recording waymo.com's own key in `external_keys` per the existing convention.
- Report rather than write: a city entering "Serving Riders In" (arrival), a city disappearing (pause or withdrawal), a city entering "Up Next" (announcement). New cities insert with `status 'announced'` for a human to classify; existing rows are never re-statused automatically.
- A `sources` row per run.
- **Distinguish "no changes" from "matched nothing" in the health report.** A parser whose selectors have rotted matches zero cities and looks identical to a quiet week. That single failure mode is what would make this scraper worse than no scraper, and it is the acceptance criterion below.

**Acceptance**: a dry run against the live page reproduces the current 11-serving / 21-up-next split exactly; a deliberately broken selector reports an error rather than "no changes"; weekly GitHub Action; Slack notification on any bucket change.

### 4.12 Mention vocabulary and the cumulative_trips promotion path

**Background**: surfaced by the fix(4.5) spot-check on 2026-08-16. `mention_type` `ride_count` conflates two different claims: "now providing more than 400,000 rides every week" and "safely serving more than 4 million passenger trips" are both `ride_count`, and `METRIC_PROMOTION` maps that type to `weekly_rides`, forcing the weekly reading on both. That single ambiguity produced both bad rows fix(4.5) corrected: a full-year 2024 total filed as a cumulative figure, and a cumulative sentence left sourcing a weekly figure under Pichai's name.

Note that the model was right in both cases. `extracted_metric.metric` correctly read `cumulative_trips` on both quotes; only the promotion map overrode it.

**Do**:
- Key promotion off `extracted_metric.metric` rather than `mention_type`, with `mention_type` as the fallback when the model returned no slug.
- Give `cumulative_trips` a promotion path, and audit the other `disclosed_metrics` slugs for the same gap.
- Re-validate the 33 backfilled events against the new mapping and report, do not auto-correct: a promotion change touching already-reviewed human decisions needs a diff a human approves.

**Acceptance**: a cumulative quote promotes to `cumulative_trips` or promotes nothing, never to `weekly_rides`; the fix(4.5) regressions in `scripts/test-promotion.ts` still pass; the re-validation report is reviewed before anything is written.

**Sequencing**: this changes extraction behaviour on a corpus that only grows, so it should land before the next backfill rather than after.

---

## Phase 5: Launch

**Ships publicly**: this phase IS the announcement.

**Goal**: flip the site from unlisted to public and announce it, with everything a first-wave visitor or crawler touches in order.

### 5.1 Indexing infrastructure

**Do**: sitemap.xml, robots.txt, per-section OG images via Vercel OG (landing, landscape, financials, earnings, milestones, methodology), Schema.org markup (Article on editorial sections, Dataset on data sections), page titles and meta descriptions per v1 8.1 keyword targets plus landscape terms ("robotaxi comparison", "Zoox vs Waymo", "AV deployment tracker").

### 5.2 Domain and auth

**Do**: the `pre-launch.md` checklist items: custom domain in Vercel plus DNS (user provides the domain; surface if none chosen), Supabase Auth Site URL and redirect allowlist update, magic-link retest against the new domain, methodology contact email swap (or user approves keeping the gmail).

### 5.3 Final freshness and correctness pass

**Do**: verify latest CPUC quarter present; every landscape snapshot as-of within a quarter; implied P&L reflects the latest reported Alphabet quarter; run the full pre-launch checklist; Lighthouse pass (95+ performance, 100 accessibility per v1 8.4); one Playwright smoke test per public route if not already present.

### 5.4 Flip and announce

**Do**: set `SITE_PUBLIC=true` in Vercel production, redeploy, verify noindex headers gone and meta robots removed; submit sitemap to Google Search Console; user announces (LinkedIn/Substack content moments are the user's to write; offer drafts). Post-announce monitoring for the first week: watch Slack for scraper failures and Vercel logs for errors.

**Acceptance**: site indexed, announcement out, no stale data visible on day one.

---

## Phases 6-8: Post-announce roadmap

Specified at heading level only; each gets a detailed module breakdown at phase start, using the v1 text as the base reference.

**Phase 6: Unit economics** (v1 Phase 2, upgraded). The assumptions table, cost-per-mile waterfall, revenue per ride, interactive calculator with shareable URL state, city breakeven. Upgrade opportunity since v1: real disclosed anchors now exist for the model (Pony's claimed per-vehicle breakeven and 1/4-to-1/5 vehicle cost, Apollo Go's $28K RT6, WeRide's $40-50K per-vehicle annual service revenue projection), so the calculator can offer "Waymo baseline" and "China cost structure" presets. On completion, wire the COGS decomposition into the implied P&L (closing the Phase 4 simplification).

**Phase 7: Safety** (v1 Phase 6). CPUC `incident_metrics` ingestion via the existing scraper, NHTSA SGO monthly scrape (now covering Waymo, Zoox, and Tesla incidents: comparative safety is now possible and is the section's editorial hook), CA DMV disengagement reports, safety dashboard with human-baseline comparisons and transparent methodology critique. The recall histories (Waymo's six, Zoox's four, Tesla's investigation) become a maintained timeline.

**Phase 8: Outlook, valuation, polish** (v1 Phases 7 and 8 remainder). Bull/bear cases with explicit probabilities, valuation framework and scenario builder (moved from Phase 4), share-this-chart PNG generation, email capture, methodology changelog.

---

## Decisions log and open decisions

Decided 2026-08-15 (Phase 4): extraction stays on the Anthropic API for now. Open-weight alternatives were reviewed via OpenRouter (DeepSeek V4 Flash at roughly 40x lower input cost, GLM 5.2 as the stronger fallback); the `ModelCaller` interface in `lib/extraction/extract.ts` is the seam for adding an OpenRouter caller and A/B-ing on the same event if cost or independence ever matters. At about $1.50 for the full backfill it does not yet.

Decided 2026-08-15: CPUC series stays, scraper rebuilt against cpuc.ca.gov directly (2.2). National disclosed-metrics time series built in Phase 2 (2.3), not deferred to Phase 4.

Open (surface before or during the named module):

1. **City status enum** for employee-only driverless markets (2.4): new status value vs. mapping. Recommendation: new 'employee' value.
2. **Announced-cities inclusion policy** (2.4): full announced list vs. only dated/operating markets. Recommendation: only dated/operating.
3. ~~Operator roster~~ Decided 2026-08-15: include minor operators; Nuro/Lucid/Uber elevated to first-class with role modeling (see 3.1).
4. **Landscape map approach** (3.3): extend CoverageMap vs. separate lighter component.
5. ~~Extraction model~~ Decided 2026-08-15: `claude-sonnet-5`.
6. ~~Transcript source~~ Resolved 2026-08-15: Motley Fool robots-permitted and accessible; scraper built against it (4.3).
7. **Custom domain** (5.2): needs a decision and registrar access before Phase 5.
8. ~~Zoox CPUC pilot data availability~~ Resolved 2026-08-15: Zoox files the CPUC template as an xlsx inside the pilot zip (Month-Level sheet, same columns); scraper reads it directly. Aurora/Tensor/WeRide pilot filings are non-template and out of scope.

## Cross-cutting requirements

Carried over from v1 unchanged: no em dashes anywhere (including this document, UI strings, and commit messages); ISR with on-demand revalidation on admin writes; scraper etiquette (robots.txt, `SCRAPER_USER_AGENT`, 2-second delays, raw documents to Storage, `pending_review` for scraped data); the footer legal disclaimer; WCAG AA accessibility; testing expectations per v1 (fixture-based scraper tests, smoke tests per route, don't over-invest early).

Working agreement carried over from `CLAUDE.md` unchanged: module by module, no chaining, commit per module, show migrations and non-trivial component structures before building, browser verification for anything touching auth or routing, flag rather than deviate, never fabricate data (UNVERIFIED briefing items stay out of the database), architecture.md maintenance block every module.

## Effort estimate

| Phase | Scope | Effort (weekends) | Public ship |
|---|---|---|---|
| 2 | Re-entry and freshness | 2-3 | Deploy only |
| 3 | Competitive landscape | 3-4 | Deploy only |
| 4 | Financials + extraction engine | 4-5 | Deploy only |
| 5 | Launch | 1 | Announcement |
| 6 | Unit economics | 3 | Yes |
| 7 | Safety | 2 | Yes |
| 8 | Outlook, valuation, polish | 2-3 | Yes |

Roughly 8-11 weekends to announcement at an opportunistic pace. The automation investment in Phase 4 is what makes the opportunistic pace survivable: after Phase 5, a month away from the project should cost freshness in exactly one place (manual disclosed-metrics entries), not everywhere.

## How Claude Code should work through this plan

Read `CLAUDE.md`, `architecture.md`, and this document in full before starting any phase. Work module by module. After each module: summarize what was built, update `architecture.md` in the same commit, propose the commit message, wait for approval. Do not chain modules. Phase 2.1's audit findings may amend this plan; the plan changes through the user, not silently. When a briefing fact is about to enter the database, re-verify it against the primary source first; the briefing is a map, not the territory.
