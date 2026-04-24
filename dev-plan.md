# The Empty Seat: Development Plan

## Purpose of this document

This is the build specification for a site called **The Empty Seat**, a research-grade website about Waymo. Claude Code will use this document to build the site. Treat it as the source of truth for scope, sequencing, and acceptance criteria. If something here is ambiguous, surface the question rather than guessing.

The site does not exist yet. This is a greenfield build in a new repo. There is no legacy code, no migration, no existing content to import. Any content beyond what is specified in this document (specific milestone entries, specific city launch dates, specific financial figures) will be provided by the user and entered through the admin UI after the relevant phase ships. Seed data for initial development can be fabricated placeholder values clearly marked as such.

## Audience and positioning

The site targets two reader segments:

1. **Growth and crossover investors** evaluating Waymo as an investment (directly via secondaries, or indirectly via Alphabet). These readers want unit economics, implied P&L, valuation framework, and competitive positioning. They are sophisticated readers of financial documents and want primary sources linked.

2. **Operators and strategists at competitive AV companies** (Tesla Robotaxi, Zoox, Pony, WeRide, Baidu Apollo) who want to benchmark against Waymo. They care about operational metrics, scaling curves, and technical milestones.

The site is Waymo-only in its public surface. A multi-company data backend exists so competitor data can be referenced in comparative sections, but no competitor gets their own landing page.

## Positioning vs. comparable sites

Two reference sites inform the design direction. Claude Code will not have access to these sites, so they are described below rather than linked.

**Humanity's Last Machine** (the aesthetic reference): a long-form research essay about humanoid robotics hardware, presented as a scrollytelling web document. Editorial typography (serif display type, generous whitespace), restrained color palette, one idea per scroll section, tasteful motion on data entering the viewport. A persistent navigation allows jumping between sections. It reads like a book you can live inside, not a dashboard. The Empty Seat should feel similar: an essay with embedded live data, not a dashboard with marketing copy bolted on.

**Robotaxi Tracker** (the operational data reference): a third-party site that tracks real-time AV operational metrics (fleet sizes, active vehicle counts, ride volumes by city, wait times). The Empty Seat will consume data from Robotaxi Tracker as an input to its operations section, with visible attribution, but will not replicate its dashboard-style presentation. Robotaxi Tracker is the commodity data layer; The Empty Seat is the research layer built on top.

## Guiding principles

1. **Research over dashboard.** Every chart has a narrative around it. Raw data without framing is not the product.
2. **Primary sources always linked.** Every non-trivial data point traces to a source row in the database. Trust is the product.
3. **Tooltips everywhere.** Every metric, acronym, and methodology assumption gets a hoverable explanation. Build the tooltip system in Phase 0 and use it in every subsequent phase.
4. **Static where possible, dynamic where necessary.** Aggressive ISR with revalidation on admin writes. Don't make things dynamic without a reason.
5. **Ship vertical slices.** Each phase that has a public face ships independently. Every ship is a distribution moment.
6. **Admin UX matters.** If annotating data is painful, the site goes stale. Budget 20% of every phase for admin ergonomics.
7. **Multi-company data, single-company site.** Every data table includes a `company_id` foreign key. The public frontend is Waymo-only. Do not build generic "company page" components or a company switcher UI in any phase covered by this plan.

## Tech stack (fixed, do not substitute)

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Framer Motion
- **Hosting**: Vercel
- **Database**: Supabase (Postgres, Auth, Storage in a single project)
- **Background jobs**: Vercel Cron for lightweight scheduled tasks, GitHub Actions for heavier scrapes
- **LLM extraction**: Anthropic API (Claude Sonnet 4, model string `claude-sonnet-4-20250514`) for structured extraction from filings and transcripts
- **Admin auth**: Supabase Auth, single admin user, magic link login
- **Maps**: Mapbox GL JS for interactive service area maps
- **Tooltip primitive**: Radix UI Tooltip
- **Form primitives**: Radix UI plus uncontrolled React state for simple forms
- **Monitoring**: Vercel logs plus a Slack incoming webhook for scraper failures

If a task appears to require a substitution (e.g., a package unavailable, an API deprecated), surface the question before installing an alternative.

## Repo layout

```
/app                    Next.js App Router routes
  /(public)             Public marketing + content routes
    /page.tsx           Landing page (Thesis + Operations stacked)
    /financials/page.tsx
    /earnings/page.tsx
    /landscape/page.tsx
    /safety/page.tsx
    /outlook/page.tsx
    /methodology/page.tsx
  /admin                Admin routes (behind auth)
    /layout.tsx         Auth gate + admin nav
    /milestones/page.tsx
    /cities/page.tsx
    ...
  /api                  Route handlers (scraper webhooks, admin mutations)
/components
  /ui                   Primitives (Tooltip, Metric, Term, Button, etc.)
  /charts               Chart wrappers around Recharts
  /sections             Page-level sections (ThesisHero, OperationsTimeline, etc.)
  /admin                Admin-specific components
/lib
  /supabase             Supabase client setup (server + browser)
  /scrapers             Scraper modules (one file per source)
  /extraction           Anthropic extraction pipeline
  /glossary             Central glossary data for tooltips
  /utils
/scripts                One-off scripts (seed, backfill, etc.)
/supabase
  /migrations           SQL migrations
  /seed.sql             Seed data
/public                 Static assets
```

Create this layout in Phase 0.1. Subsequent phases add files within it.

---

## Phase 0: Foundation

**Ships publicly**: no. Foundation only.

**Goal**: stand up the infrastructure every later phase depends on. Database, design system, admin shell, tooltip system.

### 0.1 Project scaffold

**Do**:
- Run `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*"` in the empty repo root
- Create the repo directory layout listed above (empty files/folders as placeholders where appropriate)
- Install additional dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `recharts`, `framer-motion`, `@radix-ui/react-tooltip`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `mapbox-gl`, `date-fns`, `zod`
- Configure `next.config.js` for image optimization and any required remote patterns
- Set up `.env.local.example` documenting all required environment variables (do not commit `.env.local` itself):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `NEXT_PUBLIC_MAPBOX_TOKEN`
  - `SLACK_WEBHOOK_URL`
  - `SCRAPER_USER_AGENT`
- Create a minimal `README.md` describing the project in one paragraph and linking to `dev-plan.md` and `CLAUDE.md`

**Acceptance**: `npm run dev` starts without errors, renders a blank placeholder page, `npm run lint` passes, directory structure matches the spec above.

### 0.2 Database schema

**Do**:
- Set up a Supabase project (user will provide credentials or create the project; ask if not provided)
- Write the initial migration as `supabase/migrations/0001_initial_schema.sql` with these tables:

```
companies
  id uuid pk
  slug text unique                   e.g. 'waymo', 'tesla', 'zoox'
  display_name text
  founded_year int
  parent_company text                e.g. 'Alphabet' for Waymo
  created_at, updated_at

sources
  id uuid pk
  url text
  publisher text                     e.g. 'SEC', 'Motley Fool', 'Waymo Blog'
  title text
  published_at timestamp
  scraped_at timestamp
  content_hash text                  for dedupe
  storage_key text                   for raw document in Supabase Storage
  created_at

cities
  id uuid pk
  company_id uuid fk -> companies
  name text                          e.g. 'San Francisco'
  metro_area text                    e.g. 'San Francisco Bay Area'
  country text                       default 'US'
  launch_date date
  public_access_date date             null if still waitlisted
  service_area_sq_mi numeric
  status text                         'announced' | 'waitlist' | 'public' | 'paused'
  latitude numeric
  longitude numeric
  notes text
  created_at, updated_at

milestones
  id uuid pk
  company_id uuid fk
  event_date date
  headline text
  body text                          markdown
  tags text[]                         e.g. ['new_city', 'technology', 'international']
  source_id uuid fk -> sources
  kyle_annotation text                user's 1-sentence take
  is_published boolean default false
  created_at, updated_at

fleet_snapshots
  id uuid pk
  company_id uuid fk
  city_id uuid fk                     nullable if company-wide
  snapshot_date date
  vehicle_count int
  active_vehicle_count int            nullable
  source_id uuid fk
  notes text
  created_at

ride_estimates
  id uuid pk
  company_id uuid fk
  city_id uuid fk                     nullable if company-wide
  period_start date
  period_end date
  rides_per_week int                  normalized to weekly even if period differs
  avg_fare_usd numeric                 nullable
  source_id uuid fk
  confidence text                      'high' | 'medium' | 'low'
  methodology_note text
  created_at

financial_periods
  id uuid pk
  company_id uuid fk
  fiscal_period text                   e.g. 'Q1 2026', 'FY 2025'
  period_start date
  period_end date
  revenue_usd numeric                  nullable
  opex_usd numeric                     nullable
  capex_usd numeric                    nullable
  operating_loss_usd numeric           nullable
  is_disclosed boolean                 true if from filing, false if estimated
  source_id uuid fk
  methodology_note text
  created_at, updated_at

audit_log
  id uuid pk
  user_id uuid                        nullable
  table_name text
  record_id uuid
  action text                          'insert' | 'update' | 'delete'
  before jsonb
  after jsonb
  created_at
```

- Add row-level security policies: anon users can `SELECT` from `companies`, `cities`, `milestones` (where `is_published = true`), `fleet_snapshots`, `ride_estimates`, `financial_periods`, `sources`. All write operations require authenticated role with an `is_admin` claim.
- Create triggers on every table (except `audit_log`) that write before/after state to `audit_log` on mutations.
- Seed data in `supabase/seed.sql`:
  - Insert one row into `companies` for Waymo (slug 'waymo')
  - Insert stub rows for Tesla, Zoox, Pony AI, WeRide, Baidu Apollo (for future use; these are not surfaced in the Waymo-only frontend yet)
  - Do not seed cities, milestones, or other data; the user will enter these via admin UI after Phase 0 ships

**Acceptance**: migrations run cleanly against a fresh Supabase project, RLS policies verified by attempting an unauthenticated write and seeing it fail, seed script runs and `companies` table has six rows.

### 0.3 Supabase client setup

**Do**:
- Create `lib/supabase/server.ts` (for server components, uses cookies), `lib/supabase/browser.ts` (for client components), and `lib/supabase/admin.ts` (service-role, server-only, for scraper jobs and admin mutations)
- Create TypeScript types generated from the database schema (use `supabase gen types typescript` pattern, committed to `lib/supabase/types.ts`)
- Document in a comment at the top of each client which contexts may use it (e.g., "DO NOT import admin.ts from client components")

**Acceptance**: a sample server component can fetch from `companies` table and render it; a sample client component can subscribe to realtime on a table; attempting to import `admin.ts` from a client component produces a build error or clear runtime error.

### 0.4 Design system

**Do**:
- Configure Tailwind with a custom theme in `tailwind.config.ts`:
  - Fonts: a serif for display (suggest Fraunces or Instrument Serif, loaded via `next/font/google`) and a sans for body (suggest Inter)
  - Color palette: off-white background (`#FAFAF7`), near-black text (`#0A0A0A`), one restrained accent color (suggest a deep blue or forest green, ~`#1E3A5F`), and a muted secondary for supporting text
  - Typography scale: generous, editorial (body 18px, display up to 72px)
  - Spacing: generous whitespace (Humanity's Last Machine reference point; think book-like margins)
- Create primitive components in `components/ui/`:
  - `<Container>`: max-width wrapper with consistent horizontal padding
  - `<Prose>`: styled wrapper for body text (sets font, line height, paragraph spacing)
  - `<Heading>`: serif display headings, takes `level` prop
  - `<Button>`: two variants (primary, ghost)
  - `<Card>`: subtle border, consistent radius and padding
- Create a `components/sections/PageShell.tsx` that wraps every public page with global nav and footer
- Global nav: sticky top bar with the site name "The Empty Seat" and section anchors (Thesis, Operations, Unit Economics, Financials, Earnings, Landscape, Safety, Outlook). Even if most sections are stubs until their phase ships, the nav anchors them
- Footer: methodology link, disclaimer ("The Empty Seat is an independent research project. Not affiliated with Waymo, Alphabet, or any mentioned company. Not investment advice."), contact link, last-updated global timestamp

**Acceptance**: a placeholder homepage renders with the shell, nav, and footer, matching the editorial aesthetic. `npm run build` succeeds.

### 0.5 Tooltip system

**Do**:
- Create `components/ui/Tooltip.tsx` wrapping Radix UI Tooltip with project styling (subtle shadow, consistent arrow, appropriate delay, mobile tap-to-reveal behavior)
- Create `components/ui/Metric.tsx`: renders a numeric value with a small info icon next to it; tooltip content explains the calculation, cites the source, and shows the "as of" date. Takes props: `value`, `unit`, `explanation`, `sourceUrl`, `asOf`
- Create `components/ui/Term.tsx`: inline wrapper for glossary terms. Renders children with a dotted underline, shows glossary definition on hover. Takes a `term` prop that looks up the definition from the glossary
- Create `lib/glossary/index.ts` exporting a typed glossary object. Each entry: `{ term: string; shortDefinition: string; longDefinition?: string; seeAlso?: string[] }`. Seed with foundational terms:
  - disengagement rate
  - contribution margin
  - autonomous miles
  - rider-only miles
  - remote assist
  - safety driver
  - service area
  - ODD (operational design domain)
  - 6th-generation Waymo Driver
  - Other Bets (Alphabet segment)
  - capex intensity
  - unit economics
- Definitions should be written in an editorial, plain-English voice. No em dashes. One to three sentences per term.
- Mobile behavior: tap to reveal, tap elsewhere to dismiss, auto-dismiss after 8 seconds

**Acceptance**: all three components render correctly on desktop and mobile, the glossary is centralized (editing a term in one place updates every occurrence), accessibility is sound (ARIA attributes, keyboard navigable).

### 0.6 Admin shell

**Do**:
- Create `/app/admin/layout.tsx` that checks Supabase session, redirects to `/admin/login` if not authenticated
- Create `/app/admin/login/page.tsx` with magic link login
- Create `/app/admin/page.tsx` as the admin dashboard: list of tables with row counts and links to each management view
- Create generic CRUD views for `companies`, `cities`, `milestones`, `sources`, `fleet_snapshots`, `ride_estimates`, `financial_periods`. They can be functional and plain (no need for visual polish); they need table views, create forms, edit forms, and delete confirmation
- Every mutation writes to `audit_log` via the database trigger set up in 0.2
- Add an `is_published` toggle on `milestones` (draft vs. published)

**Acceptance**: admin user can log in, view every table, create and edit rows, and see audit log entries reflecting their actions. Unauthenticated visitors to `/admin/*` are redirected to login.

### 0.7 Error monitoring

**Do**:
- Create `lib/notify.ts` with a single function `notifySlack(message: string, level: 'info' | 'warn' | 'error')` that POSTs to the Slack webhook
- Wrap scraper entry points (to be added in later phases) with try/catch that calls `notifySlack` on errors
- Add a daily digest cron (Vercel Cron) that reports scraper health (last successful run per source); placeholder for now, activated when scrapers exist

**Acceptance**: calling `notifySlack('test', 'info')` from a development environment posts to the configured Slack channel.

---

## Phase 1: Thesis and Operations

**Ships publicly**: yes. First public launch.

**Goal**: replace the placeholder landing with a proper opening narrative plus live operations data.

### 1.1 Thesis section

**Do**:
- Build `components/sections/ThesisHero.tsx`: full-viewport hero with the site name, a short tagline, and a large animated counter showing Waymo's weekly ride count. The counter pulls from the most recent `ride_estimates` row for Waymo where `city_id IS NULL` (company-wide estimate). Animation: count up from 0 to current value on first scroll into view (use Framer Motion's `useInView` and a tween).
- Below the hero: a 3-paragraph thesis written in editorial voice explaining (a) what Waymo is and how it makes money, (b) why it matters now (commercial inflection, scaling cities, unit economics question), (c) what this site does: systematic tracking of the operational and financial picture. The user will provide final copy through the admin UI; for now, render from a `thesis_copy` row in a new simple `site_content` table (key/value: `key text unique`, `markdown_body text`, `updated_at`). Placeholder copy can be drafted by Claude Code with a comment noting it is placeholder.
- Below the thesis: a key-stats band with four `<Metric>` components showing rides/week, cities served, autonomous miles, vehicles in fleet. Each pulls from the latest relevant row with appropriate tooltip explanations.

**Acceptance**: landing page renders the hero, thesis, and stats band. Counter animates correctly. Tooltips work on all metrics. Swapping the thesis copy through admin updates the page on next revalidation.

### 1.2 Operations section

**Do**:
- Build four sub-sections on the landing page below the thesis:

**1.2.a City launch timeline**. Horizontal timeline showing every city launch. X-axis is time; each city is a dot at its launch date. Clicking a dot expands a panel showing: city name, launch date, service area, current fleet, current rides/week estimate, status. Data source: `cities` table joined to latest `fleet_snapshots` and `ride_estimates`.

**1.2.b Cohort ramp chart**. The differentiating visual. X-axis is "months since city launch" (normalized to zero per city). Y-axis is rides per week (toggle-able to vehicles or rides per vehicle per day). One line per city. Lets the reader see Phoenix's ramp vs. SF's ramp vs. LA's ramp overlaid. This is a SaaS-style cohort chart applied to AV, and it is rare. Wrap with `<Metric>` tooltips explaining the methodology.

**1.2.c Coverage map**. Mapbox GL JS map centered on the US, zoomable. Each city's service area shown as a polygon. Polygons color-coded by launch cohort (2024 launches one shade, 2025 another, 2026 another). Hovering a polygon shows the city name and key stats. If `service_area_sq_mi` is stored but the actual polygon geometry is not, for v1 render a circle of equivalent area centered on `latitude, longitude`; add a `service_area_geojson` column to `cities` in a new migration for future polygon support.

**1.2.d Rides per vehicle per day chart**. Time-series line chart showing the derived metric (rides_per_week / 7) / vehicle_count, per city, over time. This is one of the most important unit economics inputs and deserves its own visual.

**Acceptance**: all four sub-sections render with seeded data; when the user adds a new city or snapshot via admin, charts update on next revalidation; mobile responsive (charts reflow, timeline becomes vertical or horizontally scrollable).

### 1.3 Robotaxi Tracker ingestion

**Do**:
- Create `lib/scrapers/robotaxi_tracker.ts`. Target: Robotaxi Tracker's public data. Start by attempting to inspect the site's network requests for JSON endpoints. If no clean API is available, fall back to HTML parsing.
- Scraper should run hourly via GitHub Action (`.github/workflows/scrape-robotaxi-tracker.yml`).
- On each run: fetch latest vehicle counts and ride volume estimates per Waymo city, compute content hash, skip insert if hash matches the most recent row, otherwise insert a new row into `fleet_snapshots` and/or `ride_estimates` with `source_id` pointing to a Robotaxi Tracker `sources` row.
- Every insert has `confidence = 'medium'` with a methodology note citing Robotaxi Tracker.
- On scraper failure, call `notifySlack`.
- Because this is a third-party source, include User-Agent header identifying the project (via `SCRAPER_USER_AGENT` env var) and respect a reasonable rate limit (one request every few seconds).
- Add a `Methodology` note on the landing page Operations section visibly attributing Robotaxi Tracker as a data source with a link.

**Acceptance**: scraper runs successfully in GitHub Actions, populates `fleet_snapshots` and `ride_estimates` with new rows, does not create duplicate rows on re-run, failures surface in Slack, frontend reflects scraped data on next revalidation.

### 1.4 Milestones feed

**Do**:
- Build `/app/(public)/milestones/page.tsx` as a dedicated milestones page, accessible from global nav
- Also build a compact "Recent milestones" module on the landing page (below Operations) showing the 5 most recent published milestones
- Each milestone card: date, headline, tags, 1-sentence annotation (if present), "Read source" link
- Tag-based filter chips at the top of the full milestones page ('New City', 'Technology', 'Operations', 'Partnership', 'International', 'Safety', 'Financial')
- Admin view already exists from 0.6; ensure `is_published` toggle is prominent and `kyle_annotation` field is labeled clearly

**Acceptance**: published milestones appear on the site, drafts do not, tag filters work, admin can toggle published state.

### 1.5 Global last-updated and sources page

**Do**:
- Footer displays "Last updated: [date of most recent row across all data tables]"
- Build `/app/(public)/methodology/page.tsx`: plain editorial page explaining data sources, update frequency, estimation methodology, a changelog of methodology updates, and a contact email for corrections
- Build `/app/(public)/methodology/sources/page.tsx`: auto-generated list of every unique source in the `sources` table, grouped by publisher

**Acceptance**: methodology page renders, sources list reflects database contents, last-updated timestamp reflects most recent mutation.

### 1.6 Ship

**Do**:
- Deploy to Vercel production
- Configure custom domain (user will provide; ask if not set)
- Verify all env vars configured in Vercel production
- Run a final review pass against acceptance criteria in 1.1 through 1.5
- Notify user that Phase 1 is ready for review before announcing

---

## Phase 2: Unit Economics

**Ships publicly**: yes.

**Goal**: the interactive unit economics model. The feature most likely to get shared by growth investors.

### 2.1 Data model

**Do**:
- New migration adding:

```
unit_economics_assumptions
  id uuid pk
  company_id uuid fk
  as_of_date date
  vehicle_cost_usd numeric
  vehicle_useful_life_years numeric
  sensor_suite_cost_usd numeric
  sensor_refresh_cycle_years numeric
  compute_cost_usd numeric
  remote_assist_ratio numeric                workers per 100 vehicles
  remote_assist_loaded_cost_per_hour numeric
  insurance_per_vehicle_per_year_usd numeric
  cleaning_and_depot_per_vehicle_per_day_usd numeric
  energy_per_mile_usd numeric
  mapping_overhead_per_vehicle_per_year_usd numeric
  avg_miles_per_ride numeric
  avg_fare_per_ride_usd numeric
  rides_per_vehicle_per_day numeric
  source_id uuid fk
  methodology_note text                       required
  is_active boolean                           only one active set per company at a time
  created_at, updated_at
```

- Seed one baseline set of assumptions for Waymo with sourced estimates. Every value needs a citation note. Where no public source exists, mark as "Kyle estimate" explicitly.

### 2.2 Cost-per-mile waterfall

**Do**:
- Build `components/charts/CostWaterfall.tsx` using Recharts
- Computes per-ride cost from the active `unit_economics_assumptions` row, decomposed into layers: vehicle amortization, sensor amortization, compute, remote assist, insurance, cleaning/depot, energy, mapping overhead
- Waterfall chart visualizing each contribution, with total on the right
- Each bar has a tooltip explaining the calculation and citing the source

**Acceptance**: chart renders correctly, numbers tie to assumptions row, tooltips present on every bar.

### 2.3 Revenue per ride build

**Do**:
- Build `components/sections/RevenuePerRide.tsx`
- Shows avg fare (from assumptions or per-city ride_estimates), take rate vs. driver payout comparison to human ride-share (illustrative only), and revenue per vehicle per day derived from rides_per_vehicle_per_day × avg_fare
- Editorial narrative framing each number

**Acceptance**: renders correctly, ties to assumptions.

### 2.4 Interactive calculator

**Do**:
- Build `/app/(public)/unit-economics/page.tsx` hosting the unit economics section
- Component `components/sections/UnitEconomicsCalculator.tsx`:
  - Sliders for: rides per vehicle per day, avg fare, vehicle cost, remote assist ratio, insurance
  - Live contribution margin output (revenue per ride minus variable costs per ride)
  - Live payback period on vehicle
  - Live contribution margin per vehicle per year
  - "What has to be true" inverse solver: user enters target contribution margin per vehicle, component back-solves the required rides/day at current fare, or required fare at current utilization
  - URL state encoding: slider values are encoded into query params so a user can share a specific scenario by copying the URL
  - Small "Reset to baseline" button that restores assumptions to the active row
- Editorial narrative frames the calculator: "The baseline below is our current best estimate of Waymo's per-vehicle economics. Move the sliders to stress-test the model."

**Acceptance**: sliders update output in real time, URL state round-trips correctly (reload the URL and sliders show the saved state), calculations are correct and match a hand check.

### 2.5 Breakeven analysis

**Do**:
- Build `components/sections/CityBreakeven.tsx`
- For each active city, model cumulative cash flow over months-since-launch:
  - Launch costs: fixed (depot buildout, mapping, regulatory), stored in `cities.launch_costs_usd` (add column via migration)
  - Monthly contribution: rides_per_week × 4.33 × contribution_margin_per_ride
  - Ramp curve: the ride count ramps based on historical `ride_estimates` for that city (actuals), projected forward using a simple logistic fit
- Chart: cumulative cash flow line per city, crossing zero is breakeven
- Table below: "Months to city-level cash breakeven" per city (nullable where projection doesn't cross zero)

**Acceptance**: chart renders, breakeven computations visible, methodology tooltip explains assumptions and limitations.

### 2.6 Ship

**Do**:
- Deploy, verify, notify user before announcement

---

## Phase 3: Implied P&L and Financials

**Ships publicly**: yes.

**Goal**: replace the thin financials table with a proper implied P&L. The section a growth investor would screenshot for an IC memo.

### 3.1 Other Bets walk

**Do**:
- Add data entry support in admin for `financial_periods` specifically covering Alphabet Other Bets segment
- Build `components/charts/OtherBetsWalk.tsx`: stacked bar chart showing Other Bets revenue and operating loss by quarter, with the user-estimated Waymo share separated out from the rest (Verily, Wing, GFiber, X residual)
- Methodology tooltip on the Waymo share bar explicitly noting this is an estimate

### 3.2 Implied Waymo standalone P&L

**Do**:
- New migration adding `implied_pnl_periods` table:

```
implied_pnl_periods
  id uuid pk
  company_id uuid fk
  fiscal_period text
  period_start, period_end date
  revenue_usd numeric                    derived from ride_estimates × avg_fare, stored for transparency
  revenue_methodology text
  cogs_usd numeric                       derived from unit economics × rides
  cogs_methodology text
  gross_profit_usd numeric
  opex_usd numeric                       allocated from Other Bets
  opex_methodology text
  operating_income_usd numeric
  capex_usd numeric
  capex_methodology text
  free_cash_flow_usd numeric
  is_locked boolean                       true when user has reviewed and approved
  created_at, updated_at
```

- Build a recompute job (cron, weekly) that regenerates unlocked periods based on current ride_estimates and unit_economics_assumptions
- Build `components/sections/ImpliedPnL.tsx`:
  - Table view of quarters down the rows, line items across the columns (revenue, cogs, gross profit, gross margin %, opex, operating income, capex, FCF)
  - Side-by-side "disclosed" (Other Bets segment revenue when Waymo is called out) vs. "modeled"
  - Every number is a `<Metric>` with methodology tooltip
  - Export as CSV button
- Admin view to lock periods and override line items with notes

**Acceptance**: P&L renders, numbers tie, CSV export matches on-screen values, tooltips on every cell, admin can lock and override.

### 3.3 Capex intensity

**Do**:
- Build `components/charts/CapexIntensity.tsx`: chart showing capex per incremental weekly ride over time (capex / change in rides per week, rolling 4-quarter window)
- Narrative framing: is Waymo getting more capital efficient as it scales?

### 3.4 Valuation framework

**Do**:
- Build `/app/(public)/financials/valuation/page.tsx` (linked from main financials page)
- Interactive "What has to be true" calculator:
  - Inputs: target 2030 valuation, assumed exit revenue multiple, assumed 2030 operating margin
  - Outputs: required 2030 revenue, implied 2030 rides per week, implied cities
  - Shareable URL state
- Comparable multiples table: ride-share comps (Uber, Lyft), tech-enabled services comps, selected transportation comps, each with a tooltip on why it was chosen as a reference

**Acceptance**: calculator works, comparable table renders, URL state round-trips.

### 3.5 Financials landing page

**Do**:
- Build `/app/(public)/financials/page.tsx` as the container for 3.1 through 3.4
- Editorial framing at the top: what this section does, methodology disclaimer
- Sections stacked with scroll nav on the left (sticky on desktop)

### 3.6 Ship

**Do**:
- Deploy, verify, notify user before announcement

---

## Phase 4: Alphabet Earnings extraction pipeline

**Ships publicly**: yes.

**Goal**: automated extraction of Waymo mentions from Alphabet filings, transcripts, and presentations.

### 4.1 Data model

**Do**:
- Migration adding:

```
earnings_events
  id uuid pk
  company_id uuid fk                     parent company (Alphabet for Waymo mentions)
  subject_company_id uuid fk             the company the mentions are about (Waymo)
  fiscal_period text                     'Q1 2026'
  event_type text                        '10-K' | '10-Q' | '8-K' | 'earnings_call' | 'investor_day' | 'press_release'
  event_date date
  source_id uuid fk
  storage_key text                       raw document in Supabase Storage
  processing_status text                 'pending' | 'extracted' | 'reviewed' | 'failed'
  extraction_version int                 for re-processing
  processed_at timestamp
  created_at, updated_at

waymo_mentions
  id uuid pk
  earnings_event_id uuid fk
  mention_type text                      'revenue_reference' | 'city_count' | 'ride_count' | 'capex' | 'operating_loss' | 'strategic_commentary' | 'forward_guidance' | 'competitive_reference' | 'safety_reference'
  quote_text text                        the actual sentence or paragraph
  speaker text                           'Sundar Pichai' | 'Ruth Porat' | 'Anat Ashkenazi' | 'Analyst: [name]' | null for filings
  extracted_metric jsonb                 { metric, value, unit, period } or null
  confidence text                        'high' | 'medium' | 'low'
  kyle_annotation text
  review_status text                     'pending' | 'approved' | 'rejected'
  page_or_timestamp text
  created_at, updated_at

extracted_metrics
  id uuid pk
  mention_id uuid fk -> waymo_mentions
  metric_name text                       'weekly_rides' | 'cities_served' | 'autonomous_miles' etc.
  metric_value numeric
  unit text
  as_of_period text                      the period the metric describes
  stated_at_event_id uuid fk             the event where it was stated
  created_at
```

### 4.2 SEC EDGAR scraper

**Do**:
- Create `lib/scrapers/sec_edgar.ts`
- Daily GitHub Action hits `data.sec.gov` (JSON API, not HTML UI) for Alphabet CIK 0001652044 (10-K, 10-Q, 8-K filings)
- Detects new filings since last run (compare accession numbers to existing `sources` table entries)
- Downloads filing HTML, stores raw in Supabase Storage, creates `sources` + `earnings_events` rows with `processing_status = 'pending'`
- Fires extraction pipeline (see 4.4)
- Respects SEC fair use: reasonable rate, user agent with contact email

### 4.3 Earnings call transcript scraper

**Do**:
- Create `lib/scrapers/motley_fool_transcripts.ts`
- Quarterly GitHub Action checks for new Alphabet earnings call transcripts
- Parses HTML into structured transcript (speaker, turn, text)
- Stores raw HTML and parsed JSON in Supabase Storage, creates `sources` + `earnings_events` rows
- Respect rate limits, user agent, robots.txt

### 4.4 Extraction pipeline

**Do**:
- Create `lib/extraction/extract_waymo_mentions.ts`
- Input: an `earnings_events` row in `pending` status
- Algorithm:
  1. Load raw document from Supabase Storage
  2. Chunk it: filings by section heading, transcripts by speaker turn (combined into ~2000 token windows)
  3. For each chunk, call Anthropic API with Claude Sonnet 4, using a structured extraction prompt that returns JSON matching the `waymo_mentions` schema
  4. Prompt must include the mention_type enum and request citations (exact quote, speaker, page or timestamp)
  5. Prompt instruction: "Only extract references to Waymo specifically. Ignore references to 'self-driving' or 'autonomous vehicles' in general unless Waymo is named or directly implied."
  6. Validate returned JSON with Zod schema; reject malformed responses and log
  7. Insert mentions with `review_status = 'pending'`
  8. Update `earnings_events.processing_status = 'extracted'`, record `extraction_version`
- Runs on cron hourly; picks up any `pending` events
- Stores extraction version so prompts can be improved and re-run

### 4.5 Admin review queue

**Do**:
- Build `/app/admin/earnings/page.tsx` showing pending mentions grouped by earnings event
- Each mention row: quote, extracted type, speaker, extracted metric, confidence
- Actions: approve, reject, edit type/metric, add `kyle_annotation`
- Bulk approve within an event
- Approving sets `review_status = 'approved'`; the mention becomes publicly visible

### 4.6 Public earnings section

**Do**:
- Build `/app/(public)/earnings/page.tsx`
- Timeline view: reverse-chron cards per `earnings_event`, each expandable to show approved mentions grouped by type. Each mention displays the quote, speaker, and `kyle_annotation` as a pull-out
- Metrics evolution view: tab that plots every numeric mention over time (weekly_rides mentioned on Q4 '24 call, Q1 '25 call, etc.)
- Verbatim search: full-text search across approved mentions using Postgres `tsvector`
- Each event gets a permalink (`/earnings/[event-slug]`) with OG image generation via Vercel OG
- Methodology link explaining the extraction process and its limitations

### 4.7 Backfill

**Do**:
- Script `scripts/backfill_earnings.ts` that, given a date range, ingests all Alphabet filings and transcripts in that range
- Run for the last 8 quarters as initial corpus

### 4.8 Ship

**Do**:
- Deploy, run backfill, review all extractions before announcing
- Notify user before public announcement

---

## Phase 5: Competitive Landscape

**Ships publicly**: yes.

**Goal**: Waymo vs. the field. Positions Waymo's lead as a tangible, updating number.

### 5.1 Competitor data model

**Do**:
- Add to existing `companies` table: rows for Tesla Robotaxi, Zoox, Pony AI, WeRide, Baidu Apollo (already seeded in 0.2)
- New migration adding `competitor_snapshots`:

```
competitor_snapshots
  id uuid pk
  company_id uuid fk
  snapshot_date date
  cities_served int
  vehicle_count int
  weekly_rides int
  autonomous_miles_cumulative numeric
  funding_total_usd numeric
  implied_valuation_usd numeric
  disclosure_source_id uuid fk
  notes text
  created_at
```

- Admin entry forms for competitor data

### 5.2 Side-by-side comparison

**Do**:
- Build `components/sections/CompetitorTable.tsx`
- Columns: Waymo, Tesla, Zoox, Pony, WeRide, Baidu
- Rows: cities served, vehicles deployed, weekly rides, autonomous miles, funding total, most recent valuation
- Each cell shows value + "as of" date (some competitors disclose less frequently)
- Visual "lead multiple" indicator on Waymo row where applicable

### 5.3 Waymo vs. Tesla weekly rides chart

**Do**:
- Time-series chart pulling from `ride_estimates` for Waymo and Tesla (Tesla data from Robotaxi Tracker scraper; extend Phase 1 scraper to also capture Tesla if available, or add a new source)
- Annotate key events on the chart (major city launches, announcements)

### 5.4 China context

**Do**:
- Separate section on WeRide, Pony, Baidu Apollo
- Editorial framing: regulatory and market structure differences, what China scale implies for US TAM
- Static table of key metrics

### 5.5 Ship

**Do**:
- Deploy, verify, notify user before announcement

---

## Phase 6: Safety Dashboard

**Ships publicly**: yes.

**Goal**: own the narrative on the data bears use to attack Waymo.

### 6.1 Data ingestion

**Do**:
- NHTSA Standing General Order incident data: monthly scrape (`lib/scrapers/nhtsa_sgo.ts`). Filter for Waymo-involved incidents.
- CA DMV disengagement report: annual scrape (`lib/scrapers/ca_dmv_disengagement.ts`), published in February.
- Waymo Safety Hub blog: RSS scrape, filed as `milestones` with `safety` tag

### 6.2 Safety metrics dashboard

**Do**:
- New migration: `safety_incidents` and `disengagement_reports` tables (schemas sized to scraper output)
- Build `/app/(public)/safety/page.tsx`:
  - Incidents per million miles, time-series
  - Serious-injury comparison vs. human baseline (with methodology tooltip)
  - Disengagement rate trend over years where reported
  - Incident type breakdown (bar chart)
- Editorial framing: this is the data bears use; we show it transparently

### 6.3 Transparency annotations

**Do**:
- Each incident row links to source filing
- Methodology section acknowledges critiques (reporting lag, threshold differences)

### 6.4 Ship

**Do**:
- Deploy, verify, notify user before announcement

---

## Phase 7: Bull and Bear cases

**Ships publicly**: yes.

**Goal**: explicit scenario analysis. The closing argument.

### 7.1 Structure

**Do**:
- Build `/app/(public)/outlook/page.tsx` with three sub-sections stacked:
  1. Bull case narrative + numbers
  2. Bear case narrative + numbers
  3. Author's weighted view with explicit probability estimates and watch items
- Each case cites modules from prior phases (operations, unit economics, financials) as evidence

### 7.2 Scenario builder

**Do**:
- Reuse the valuation framework component from Phase 3.4
- Pre-configure bull and bear scenarios as named presets

### 7.3 Ship

**Do**:
- Deploy, verify, notify user before announcement

---

## Phase 8: Polish and distribution

**Ships publicly**: ongoing.

**Goal**: make the site shareable and discoverable.

### 8.1 SEO and metadata

**Do**:
- Per-section OG images via Vercel OG
- Schema.org `Article` markup on editorial sections, `Dataset` on data sections
- Sitemap at `/sitemap.xml`, robots.txt
- Target keywords in page titles and meta descriptions: "Waymo financials", "Waymo revenue", "Waymo unit economics", "Waymo valuation", "Waymo cities"

### 8.2 Share features

**Do**:
- "Share this chart" button on every chart; generates a PNG with data embedded for direct tweeting
- Deep-link state on interactive components (unit economics calculator, valuation framework)

### 8.3 Email capture

**Do**:
- Small email form in the footer: "Get quarterly research updates"
- Posts to a simple `email_subscribers` table (no double opt-in complexity in v1)
- No gating on site content

### 8.4 Performance and accessibility

**Do**:
- Lighthouse audit: target 95+ on performance, 100 on accessibility
- Proper alt text on charts (text summary), keyboard nav on all interactive components, screen reader tested

### 8.5 Methodology changelog

**Do**:
- Turn `/methodology` into a versioned document with a changelog at the bottom tracking every methodology update

---

## Cross-cutting requirements

- **No em dashes** in any user-facing content. Use commas, semicolons, colons, or parentheses. This applies to UI strings, tooltip text, glossary definitions, editorial copy, and any content generated programmatically.
- **Caching**: every public page uses ISR with a 1-hour revalidation by default; admin mutations trigger on-demand revalidation of affected pages.
- **Scraper etiquette**: respect robots.txt, use the `SCRAPER_USER_AGENT` env var including a contact email, rate-limit requests (minimum 2 seconds between requests per source), cache aggressively.
- **Legal**: display "The Empty Seat is an independent research project. Not affiliated with Waymo, Alphabet, or any mentioned company. Not investment advice." in the footer on every page.
- **Accessibility**: every interactive component keyboard-navigable, every chart has a text summary, color contrasts meet WCAG AA.

## Testing expectations

- Component-level: critical UI components (Tooltip, Metric, UnitEconomicsCalculator, ImpliedPnL table) have lightweight Jest or Vitest tests for key behaviors
- Scraper-level: every scraper has a test that runs against a local fixture file (don't test against live third-party sites in CI)
- E2E: one Playwright smoke test per public route confirming it renders without error

Don't over-invest in tests early. Priority is shipping phases; tests where they protect critical paths (money numbers, extraction correctness).

## Effort estimate

| Phase | Scope | Effort (weekends) | Public ship |
|---|---|---|---|
| 0 | Foundation + tooltip system | 2 | No |
| 1 | Thesis + Operations | 3 | Yes |
| 2 | Unit Economics | 3 | Yes |
| 3 | Implied P&L + Financials | 3 | Yes |
| 4 | Earnings extraction | 4 | Yes |
| 5 | Competitive Landscape | 2 | Yes |
| 6 | Safety | 2 | Yes |
| 7 | Bull/Bear | 1 | Yes |
| 8 | Polish | 2 | Ongoing |

Roughly 22 weekends total. Phases 2, 3, and 4 carry the site. Ship each phase with a content moment on LinkedIn and Substack.

## How Claude Code should work through this plan

Read this document in full before starting any phase. Work module by module (e.g., 0.1, then 0.2, then 0.3). After each module, summarize what was built, propose the next commit message, and wait for approval before proceeding to the next module. Do not chain modules. Surface any ambiguity before writing code. When the plan is incomplete (e.g., specific copy text, specific environment variable values, specific source URLs), ask the user. When uncertain whether a deviation from the plan is warranted, flag it for the user rather than silently deviating.
