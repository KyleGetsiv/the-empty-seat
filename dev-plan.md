# The Empty Seat: Development Plan v3

Revised 2026-09-20. Supersedes v2 (adopted 2026-08-15; last v2 revision is the commit before this one). v1 remains in git history at `52adb78`.

## Purpose of this document

This is the build specification: scope, sequencing, and acceptance criteria for work that is not yet done. It is one of five documents, each with one job:

| File | Answers |
|---|---|
| `CLAUDE.md` | How we work: stack, working agreement, rules |
| `architecture.md` | What exists right now, and the authoritative debt ledger |
| `schema.md` | What each table means and its gotchas |
| `dev-plan.md` (this file) | What gets built next, and in what order |
| `build-log.md` | How each finished module got built, and why it looks the way it does |

v2 mixed the last two. Finished modules carried long "(Built ...)" narratives while the unbuilt financial modules were three sentences each, pointing at v1 text that lives only in git history. v3 moves every build narrative to `build-log.md` verbatim (reasons are not re-derivable, so none are cut) and writes the open modules out in full. No open module in this document depends on text in git history.

If something here is ambiguous, surface the question rather than guessing.

## What changed since v2 (decisions, September 2026)

1. **The site gets subscribers and a recurring dispatch.** Visitors can subscribe by email. A monthly AI-assembled dispatch covers new markets, new data, earnings, vehicles, regulatory and safety developments, and what to watch next. It is a data dispatch, deliberately unlike an essay: every figure is templated from the database and the model writes only connective prose. Issues are archived on the site at `/dispatch`.
2. **One review gate, worked weekly.** A unified admin inbox becomes the single place the owner approves new facts, every Friday or Saturday. Approval publishes to the site and makes the item eligible for the next dispatch in the same action. There is no separate review for the email. Regulatory data parsed by code does not wait for review.
3. **A news monitor feeds the inbox.** A model-assisted monitor reads a fixed list of first-party sources (operator newsrooms, IR pages, regulators) and drafts proposed changes. It reuses the 4.4 extraction machinery. The `waymo.com` roster scraper (v2 module 4.11) becomes its first source.
4. **The milestones feed becomes industry-wide.** Competitor milestones are first-class, shown with a company chip.
5. **Substack was considered and rejected** as dispatch infrastructure: no publishing API as far as we know (re-verify if this is ever revisited), the archive and its search traffic would live off-site, and AI data dispatches would sit beside the owner's personal essays. The site owns the dispatch; Alpha Work stays the opinion layer; each links to the other.
6. **Stack additions approved:** Resend (transactional and dispatch email) and Vercel Web Analytics. `CLAUDE.md` is amended in the same commit as this plan.
7. **Phases renumbered.** Two new phases (The Desk, Dispatch) land before Launch. No commits were ever made against v2 phases 5 through 8, so `feat(5.1)` and later prefixes carry no collision.

## Audience and positioning

Unchanged from v2:

1. **Growth and crossover investors** evaluating Waymo (directly via secondaries, or via Alphabet) who want unit economics, implied P&L, valuation framework, and competitive positioning with primary sources linked.
2. **Operators and strategists at AV companies** benchmarking against Waymo.

Positioning: The Empty Seat is Waymo research first, with the competitive field tracked at disclosed-data fidelity around it. Robotaxi Tracker and The Charge Port are the commodity live-dashboard layer; The Empty Seat is the research layer: sourced, editorial, and opinionated about what the numbers mean. The dispatch extends that: a sourced monthly record of what changed, where every line links to the row and the source behind it.

## Guiding principles

Principles 1 through 9 carry over from v2 (research over dashboard; primary sources always linked; tooltips everywhere; static where possible; ship vertical slices; admin UX matters; multi-company data with a Waymo-deep frontend; disclosed sources, not community-tracked; confidence labeling is non-negotiable in comparative contexts). Two are added:

10. **One gate.** A fact is reviewed once. Approval publishes it to the site and queues it for the dispatch. A live table holds only approved facts: if a row is in `cities` or `disclosed_metrics`, it is public and it is true to the best of the owner's review. Unreviewed material lives in a staging table, never in a live table behind a flag.
11. **Generated prose states only reviewed facts.** The dispatch generator receives a structured payload of approved changes and may not introduce a number, name, or date that is absent from it. This is enforced by a check, the same way `verifyQuote` enforces verbatim quotes, and an issue that fails the check does not reach the send button.

## Tech stack

Unchanged from `CLAUDE.md`, plus: **Resend** for email (double opt-in, dispatch sends, delivery webhooks) and **Vercel Web Analytics** for page analytics. Extraction and generation model: `claude-sonnet-5`, recorded on every generated row. Do not substitute without asking.

## Phase map

| v3 phase | Content | v2 origin | Status |
|---|---|---|---|
| 0, 1 | Foundation; Thesis and Operations | same | Done |
| 2 | Re-entry and freshness | same | Done 2026-08-15 |
| 3 | Competitive landscape | same | Done 2026-08-15 |
| 4 | Financials and the extraction engine | same | 4.1 to 4.7 and 4.12 done; 4.8, 4.9, 4.10, 4.13, 4.14 open |
| 5 | The Desk: review inbox and news monitor | new (absorbs v2 4.11) | Open |
| 6 | Dispatch: subscribers, generator, archive, analytics | new (absorbs v1 8.3 email capture, pulls v2 5.2 domain forward) | Open |
| 7 | Launch | v2 Phase 5 | Open |
| 8 | Unit economics | v2 Phase 6 | Post-announce |
| 9 | Safety | v2 Phase 7 | Post-announce |
| 10 | Outlook, valuation, polish | v2 Phase 8 | Post-announce |

**The announce bar**, updated. The site goes public when: (a) nothing on it is visibly stale, (b) the financials section with the implied Waymo P&L exists, (c) multi-operator coverage exists (met in Phase 3), (d) a visitor can subscribe and the `/dispatch` archive holds at least two issues. Announce traffic is a one-time spike, and a launch without a subscribe path spends it.

---

## Section 0: Before anything else

Housekeeping that lands with, or immediately after, the v3 commit. None of it is a module.

1. **The v3 commit carries the uncommitted 4.12 wrap-up.** `architecture.md` (orphan `cities_count` finding, annual-total gap rewrite), the 4.12 acceptance notes (now in `build-log.md`), and `scripts/audit-promotion-mapping.ts` (orphan reporting, post-fix promotion detection) have sat uncommitted since 2026-08-20. They ship in the same commit as this plan, named in the commit message.
2. **New files in the same commit:** `build-log.md` (every v2 "(Built ...)" note, verbatim, under its module number) and `briefing-2026-08.md` (the v2 "State of the world" section, archived as a dated snapshot; it is five weeks old and must not be read as current).
3. **`CLAUDE.md` edit set** (shown for approval before writing): session-start reading list gains `build-log.md`; stack gains Resend and Vercel Web Analytics; architecture principles gain v3 principles 10 and 11; build status rewritten to match the phase map above (it still says "Next: 4.12"); the maintenance block gains one line, "build narrative goes to `build-log.md`, not `dev-plan.md`".
4. **Freshness catch-up, one session, no new code.** The site has been idle since 2026-08-20. Check and fix: all four GitHub Actions green and still reaching Slack; CPUC Q2 2026 landed (it was due 2026-08-01); Baidu Apollo Go and Pony.ai Q2 snapshots (overdue since 2026-08-18); WeRide and Zoox snapshot ages; city roster against `waymo.com`; any EDGAR events waiting in the review queue. Record findings in `architecture.md`.
5. **Pending-user items from the debt ledger:** regenerate `lib/supabase/types.ts`; set `GITHUB_DISPATCH_TOKEN` and exercise the reprocess button once; remove the duplicate `SCRAPER_USER_AGENT`; decide the orphan `cities_count 11 @ 2026-04-29` row (re-cite from the Q1 2026 call or delete).

---

## Phases 2 and 3: complete

Module-by-module detail and every design note: `build-log.md`. Summary:

- **Phase 2** (2.1 to 2.7): resumption audit; CPUC scraper rebuilt against cpuc.ca.gov with overdue-quarter Slack WARN; `disclosed_metrics` and the national trajectory chart; city roster refresh with the 'employee' status; milestones backfill; announce-visible debt paydown; docs revision.
- **Phase 3** (3.1 to 3.5): operator programs and roles; competitor snapshots with `disclosure_quality`; `/landscape`; CPUC deployment-vs-pilot comparison (Waymo, Zoox, Nuro); Tesla prose sidebar.

v2 open decisions 1, 2 and 4 (city status enum, announced-cities policy, landscape map approach) were all decided and built in those phases; see the decisions log.

---

## Phase 4: Financials and the extraction engine

**Ships publicly**: yes (deployed; announcement held for Phase 7).

**Goal**: the implied Waymo P&L (the artifact an investor screenshots for an IC memo) on top of an automated earnings-extraction pipeline, so the financial picture refreshes itself each quarter.

**Done** (detail in `build-log.md`): 4.1 data model; 4.2 EDGAR scraper; 4.3 transcript scraper; 4.4 extraction pipeline; 4.5 review queue and fix(4.5); 4.6a and 4.6b public earnings section with permalinks, disclosure-posture matrix, client filter, shared OG route; 4.7 backfill (33 events, 162 approved mentions); 4.12 promotion keyed off the model's reading.

**Retired number**: 4.11 (Waymo site roster scraper) moves to 5.4, because its "report, do not write" design is the staging pattern Phase 5 builds.

**Execution order for what remains**: 4.13, 4.8, 4.9, 4.10, then 4.14 (4.14 can float; nothing on the announce bar depends on it).

**Sequencing note, carried from v2**: the implied P&L ships without the unit-economics COGS derivation, which arrives in Phase 8. Gross-margin decomposition is explicitly marked "arrives with the unit economics module" in the P&L's methodology tooltip from day one, and upgrades in place.

### 4.13 The Q2 2026 call

**Background**: Motley Fool published no Alphabet transcript for Q2 2026 (or Q3 2024). The Q2 2026 call is available from Alphabet IR (abc.xyz). It closes the last UNVERIFIED item from the August briefing: what was said about Waymo on that call.

**Do**:
- robots.txt check on abc.xyz first; surface the result.
- Ingest the Q2 2026 call as an `earnings_events` row through the existing pipeline. If the IR format differs enough from Fool's that the transcript parser does not apply, surface the choice between a small IR parser and a one-off manual ingest script before writing either. One document does not justify a scraper; a recurring gap does, and Fool has now skipped two of nine quarters.
- Review the extracted mentions in the queue.

**Acceptance**: the Q2 2026 call appears on `/earnings` with reviewed mentions; the decision about a recurring IR fallback is recorded.

### 4.8 Other Bets walk

**Background**: v1 specified hand entry of Other Bets figures. Since then the extraction pipeline reads `revenue_usd` and `operating_loss_usd` from every 10-Q, 10-K and earnings release, and 4.12 deliberately promotes those slugs to nothing, "pending the Other Bets walk". Hand entry would make the P&L the one financial surface that rots each quarter, against v2 decision 3 (automation is prioritized).

**Do**:
- Give `revenue_usd` and `operating_loss_usd` a promotion path into `financial_periods` (company Alphabet, segment Other Bets, `is_disclosed true`, source from the event). Surface first: `financial_periods` has no segment column, so either the Other Bets rows are keyed by a convention on `company_id` and `methodology_note`, or a `segment text` column is added by migration. Recommendation: the column. Show the SQL.
- The same promotion rules as `disclosed_metrics` apply: one row per (company, segment, fiscal_period); a restated figure updates in place with a note; rejecting the mention withdraws the row if nothing else cites it. Extend `decidePromotion` tests rather than writing a parallel path.
- Backfill from the 33 events already reviewed, as a report a human approves (the 4.12 audit pattern), never an automatic write over reviewed decisions.
- Admin entry on `/admin/financial-periods` stays, as the fallback and for the Waymo-share estimate.
- Build `components/charts/OtherBetsWalk.tsx`: stacked bars of Other Bets revenue and operating loss by quarter, with the owner-estimated Waymo share separated from the rest (Verily, Wing, GFiber, X residual). The Waymo share is an estimate and is rendered as one: open or hatched fill, a methodology tooltip on the bar, per principle 9.
- The Waymo-share estimate needs a value per quarter from the owner. Ask; do not fabricate. Until provided, the chart renders the disclosed segment totals only.

**Acceptance**: approving an Other Bets revenue mention writes or links a `financial_periods` row and never a `disclosed_metrics` row; the walk renders every quarter from Q2 2023 forward from promoted data; the estimate is visually distinct from disclosed figures; fix(4.5) and 4.12 regression tests still pass.

### 4.9 Implied Waymo standalone P&L

**Do**:
- New migration (show SQL first), `implied_pnl_periods`:

```
implied_pnl_periods
  id uuid pk
  company_id uuid fk
  fiscal_period text
  period_start, period_end date
  revenue_usd numeric            derived: disclosed rides x modeled fare, stored for transparency
  revenue_methodology text
  cogs_usd numeric               null until Phase 8
  cogs_methodology text          states the simplification plainly
  gross_profit_usd numeric       null until Phase 8
  opex_usd numeric               allocated from Other Bets
  opex_methodology text
  operating_income_usd numeric
  capex_usd numeric
  capex_methodology text
  free_cash_flow_usd numeric
  is_locked boolean              true when the owner has reviewed and approved
  created_at, updated_at
```

- **Assumptions store (spec gap in v2).** The revenue build needs a modeled average fare, and the opex build needs an Other Bets allocation share; the assumptions table does not arrive until Phase 8. Surface before building: a small `model_assumptions` table now (key, value, unit, as_of, source_id nullable, rationale), designed so Phase 8 extends it and does not replace it. Every assumption is owner-provided with a rationale; placeholders are marked and never ship.
- **Rides between disclosures (modeling decision, surface it).** Weekly-rides disclosures are episodic. A quarter's revenue needs a rides figure for the whole quarter. Options: step function from the last disclosure, linear interpolation between disclosures, or CPUC-shaped interpolation. The choice is stated in `revenue_methodology` on every row.
- Recompute: regenerate unlocked periods when an input changes (a promoted metric, an assumption edit) via the admin write path, plus a weekly safety-net run. Vercel Hobby crons are daily-only, so the weekly run is a GitHub Action.
- Build `components/sections/ImpliedPnL.tsx`: quarters down the rows, line items across (revenue, COGS, gross profit, gross margin, opex, operating income, capex, FCF). Disclosed and modeled values in visibly different treatments. Every number is a `<Metric>` with a methodology tooltip. CSV export whose values match the screen.
- Admin view to lock periods and override line items with a note.

**Acceptance**: P&L renders; numbers tie; CSV matches on-screen values; tooltips on every cell; COGS and gross margin cells state that they arrive with unit economics; admin can lock and override; a changed assumption recomputes unlocked periods and leaves locked ones alone.

### 4.10 Financials landing page and ship checkpoint

**Do**:
- Build `/app/(public)/financials/page.tsx` as the container: editorial opening with a methodology disclaimer (site_content key, placeholder marked), sticky scroll nav on desktop, sections stacked: Other Bets walk, implied P&L, link to `/earnings`.
- Capex intensity chart (capex per incremental weekly ride, rolling four quarters) only if the data supports it; otherwise defer to Phase 8 and say so in `architecture.md`.
- The valuation framework (v1 3.4) stays in Phase 10 with the outlook work.
- Reads go through `lib/supabase/public.ts`. Add Financials to the nav. Add a `financials` kind to `/api/og/[kind]/[id]` only if the page has a natural id; otherwise leave it for 7.1.
- Deploy; verify; update `architecture.md` and `pre-launch.md`; notify the owner.

**Acceptance**: `/financials` renders from real data, browser-verified, mobile responsive; nav link live; Phase 4 acceptance criteria re-checked end to end.

### 4.14 Metric vocabulary cleanup

**Background**: three small schema gaps from the 4.12 audit, bundled because each is a few lines and all touch the same promotion path.

**Do**:
- Add a period-total metric slug (for example `annual_trips`, with the period carried in `notes` or a `period` column; surface the shape). This is what lets the Q4 2024 Pichai quote ("more than 4 million passenger trips" during 2024) publish its figure. It sits approved and unpromoted today.
- Add `mentions_extracted` to `earnings_events` so a public surface can tell "extracted several, approved none" from "extracted none"; update `PRESENCE_COPY` to use it.
- Decide the two-figures-one-mention limit: the Q4 2025 call quote stated both 20 million cumulative and 400,000 weekly, and one mention holds one metric. Options: allow the reviewer to split a mention, or accept the limit and document it. Surface; do not build before the decision.

**Acceptance**: migration reviewed and applied; the Q4 2024 mention promotes to the new slug after a human re-approves it; promotion tests extended; no existing `disclosed_metrics` row changes.

---

## Phase 5: The Desk

**Ships publicly**: indirectly. The inbox is admin-only; its output is a fresher site.

**Goal**: one place where the owner reviews every new fact in under ten minutes a week, fed by monitors that draft and never publish. The May to August hiatus and the August to September gap both failed the same way: the data went stale because keeping it fresh required opening six admin pages and remembering what to look for. The Desk replaces remembering with a queue.

**Design decisions taken at planning time (2026-09-20)**:
- **Staging table over per-table draft flags.** Only `milestones` (`is_published`) and `waymo_mentions` (`review_status`) have a draft state. `cities`, `disclosed_metrics`, `competitor_snapshots`, `fleet_snapshots` and `financial_periods` are public on write, and every public query assumes it. Adding a review flag to each would touch every query and RLS policy, and one missed filter would publish unreviewed model output. Monitors therefore write only to `proposed_changes`; approval applies the change to the live table through the same validation the admin forms use.
- **Auto-approve tiers.** Publish on arrival, no review: CPUC filings (already true today; parsed by code from regulator files) and `waymo.com` roster membership (see 5.4 for exactly what that does and does not cover). Everything else waits: SEC table figures, NHTSA recalls, every model-drafted item. Auto-applied changes still appear in the inbox as an "applied, FYI" strip so the owner sees them, and still flow to the dispatch.
- **Weekly review, monthly send.** The inbox is worked every Friday or Saturday. A missed week costs a week of site freshness, never a dispatch issue.

### 5.1 Proposed changes: the staging table and apply layer

**Do**:
- Migration (show SQL first), `proposed_changes`: `id` uuid pk; `target_table` text (whitelist: milestones, cities, disclosed_metrics, competitor_snapshots, fleet_snapshots); `operation` 'insert' | 'update'; `target_id` uuid nullable (required for update); `payload` jsonb (the proposed column values); `company_id` fk; `source_id` fk (required); `quote_text` text (the verbatim passage supporting the change, verified against the stored source before insert); `origin` text (for example `monitor:waymo-blog`, `roster`, `quick-add`); `dispatch_section` text; `status` 'pending' | 'approved' | 'rejected' | 'auto_applied'; `applied_record_id` uuid nullable; `model` text nullable; `reviewed_at`; `created_at`. RLS: no anon access at all. UUID pk, so the audit trigger applies.
- `lib/desk/apply.ts`: one apply function per whitelisted table. Validates the payload with the same zod shape the admin form uses (extract shared schemas where the forms currently validate inline), writes with `supabaseAdmin`, records `applied_record_id`, revalidates the affected public paths. An update re-reads the target row first and refuses if it changed since the proposal was drafted; a stale proposal is shown as stale, never applied over a newer hand edit.
- Dedupe on insert: a proposal identical to a pending or previously rejected one (same target, same payload hash, same source URL) is dropped and counted, so a monitor re-reading a feed does not refill the queue with items the owner already rejected.
- Tests for the apply layer with fixtures: insert, update, stale update refused, whitelist enforced, rejected-duplicate dropped.

**Acceptance**: a hand-inserted proposal for each whitelisted table can be approved into the live table and appears on the public site after revalidation; a proposal against a non-whitelisted table is refused; nothing in `proposed_changes` is readable by anon (extend `scripts/test-rls.ts`).

### 5.2 The unified inbox

**Do**:
- `/admin/review`: one page listing everything awaiting the owner, grouped by dispatch section: pending `proposed_changes`, earnings events with pending mentions (as one row per event linking to the existing 4.5 queue, which stays the right tool for quote review), and draft milestones. Plus the "applied, FYI" strip for auto-applied changes since the last visit.
- Each proposal card shows: what would change (a before and after diff for updates), the verbatim quote, a link to the stored source, origin, and age. Actions: approve, edit then approve, reject. Bulk approve within a group.
- Ergonomics are the module, per principle 6. Keyboard: `j`/`k` to move, `a` approve, `r` reject, `e` edit, `o` open source. No page reload between items. Target: ten typical items cleared in under ten minutes, measured once with the owner during verification.
- Weekly Slack nudge, Friday morning Pacific: counts per section and a direct link. Repeats weekly while anything is pending; a queue older than three weeks escalates to WARN. Vercel Hobby crons are daily, so the daily health cron checks the weekday.
- `/admin` dashboard gains a pending-review count.

**Acceptance**: browser-verified end to end under the `(protected)` layout (this touches routing under the auth gate); an approved proposal is live on the public site within one revalidation; keyboard flow works without a mouse; the Friday nudge fires in a simulated run.

### 5.3 Industry-wide milestones and the tag vocabulary

**Background**: `milestones` has always had `company_id`, but no public query filters on it and the copy says "Waymo". A competitor milestone entered today would appear unlabeled in the homepage feed. Decision 2026-09-20: the feed becomes industry-wide.

**Do**:
- Company chip on `MilestoneCard`; company filter chips on `/milestones` beside the tag chips; the homepage `RecentMilestones` shows the industry feed with chips. Surface one choice: whether the homepage strip weights Waymo (for example at least three of five) or is strictly most-recent.
- `MILESTONE_TAGS` gains `vehicles` and `regulatory` (no migration; `tags` is `text[]`). Re-tag existing rows where `technology` or `operations` was standing in for either, via an idempotent `scripts/update-*.ts` with a dry-run report.
- Map tags to dispatch sections in one place (`lib/dispatch/sections.ts`), so the monitor, the inbox grouping, and the generator share one vocabulary.
- Move `/milestones` and the homepage reads to `lib/supabase/public.ts`, closing the debt item where an admin sees draft milestones on public pages.
- Update copy that says milestones are Waymo's history (`schema.md`, page intro, glossary).

**Acceptance**: a Zoox milestone renders with its chip on `/milestones` and the homepage; filters work; an admin browsing public pages sees no drafts; no em dashes in any new label.

### 5.4 Source check and the roster scraper

**Do, part one: the source check (no code).** For each candidate source, record in a table shown to the owner before any parser is written: robots.txt verdict for our user agent, whether an RSS feed or sitemap exists for discovery, update frequency, and whether pages render without JavaScript. Candidates: Waymo blog, Zoox, Nuro, Pony.ai IR, WeRide IR, Baidu IR, Uber newsroom and IR, NHTSA recalls API, CPUC press and AV program pages, CA DMV permit holder pages. Tesla has no press office and announces on X, which we do not scrape; Tesla news arrives through 5.6. Press outlets are out of scope: copyright exposure, and principle 8 (disclosed sources).

**Do, part two: the roster scraper (v2 4.11, re-homed).** `waymo.com` sorts cities into "Serving Riders In" and "Up Next". It cannot distinguish `public` from `waitlist`, or `employee` from `announced`. The scraper therefore maintains membership, and the owner's 2026-09-20 decision to auto-approve it means exactly this:
- A city new to "Up Next" is inserted into `cities` as `announced`, auto-applied. That status is the floor and cannot be wrong.
- A city moving into "Serving Riders In", or disappearing from either list, is auto-recorded as a fact (a `proposed_changes` row with status `auto_applied` that writes a dated milestone: "Waymo lists X under Serving Riders"). The **status change itself** (`public` vs `waitlist`, or `paused`) lands as a pending proposal, because the page does not contain the answer. An existing row is never re-statused automatically.
- Match by name, recording waymo.com's key in `external_keys`. A `sources` row per run.
- **Distinguish "no changes" from "matched nothing".** A parser whose selectors have rotted matches zero cities and looks like a quiet week. Zero matches is an error and a Slack WARN.

**Acceptance**: the source table is reviewed by the owner; a dry run reproduces the live "Serving" and "Up Next" split exactly; a deliberately broken selector reports an error, never "no changes"; weekly GitHub Action; bucket changes reach the inbox as specified above.

### 5.5 The news monitor

**Do**:
- `lib/monitor/`: per-source discovery from the feed or sitemap found in 5.4 (never by guessing URLs; the fool.com 429 rule), new items only (dedupe on URL and `content_hash`), raw page to Storage, standard etiquette.
- Extraction reuses `lib/extraction/`: the `ModelCaller` seam, forced tool use, per-item validation with shape repair, `verifyQuote`, the drop log, per-run cost in Slack. New schema: each item is a development with `company`, `event_date`, `headline`, `summary`, `tags`, a verbatim `quote_text`, and an optional structured change (a city status, a disclosed metric, a fleet figure) expressed as a `proposed_changes` payload. Do not modify `lib/extraction/text.ts` passage derivation: the 4.5 source viewer re-derives passage ids from it.
- **Materiality filter.** A newsroom publishes hiring posts and rider stories. The prompt defines a development (a market opening or status change, a disclosed figure, a vehicle or platform event, a permit, recall or probe, a partnership with operational effect, a financing) and the model returns nothing for the rest. Expect tuning: log every skipped item's title and the reason, reviewable from the inbox, so a wrongly skipped post is findable.
- One development drafts one milestone proposal, plus a structured proposal when the post states one. The two are linked so approving the city change and its milestone is one action.
- **Rot detection per source**: a feed that returns nothing parseable, or no new items for longer than its observed cadence allows, is a Slack WARN. Green no-ops are the failure this project has already had twice.
- GitHub Action, daily. The monitor never writes to a live table.

**Acceptance**: a backfill over the prior 30 days of the Waymo blog produces proposals the owner judges mostly material (measure: fraction approved; record it, and tune if under half); every proposal's quote verifies against its stored source; a dead feed WARNs; per-run cost appears in Slack; nothing reaches a public page without approval.

### 5.6 Quick-add by URL

**Do**: a field on `/admin/review`: paste a URL, the server fetches that one page (robots.txt respected), stores it, runs the 5.5 extraction on it, and the result lands in the inbox like any other proposal with origin `quick-add`. This is the path for Tesla, for press-reported facts (which carry `disclosure_quality 'press_reported'` and never drive headline surfaces), and for anything the source list misses. If the fetch is blocked, the form falls back to manual entry of headline, date, quote, and source URL.

**Acceptance**: a pasted Waymo blog URL yields a reviewable proposal in under a minute; a blocked URL degrades to the manual form.

### 5.7 Ship checkpoint

Deploy; two consecutive weekly reviews completed by the owner using only the inbox; update `architecture.md`, `schema.md`, `pre-launch.md`; record inbox timing and monitor approval rate in `build-log.md`.

---

## Phase 6: Dispatch

**Ships publicly**: yes (deployed; announcement held for Phase 7).

**Goal**: a visitor can subscribe; once a month the site assembles, the owner previews, and subscribers receive a sourced record of what changed. Every issue lives permanently at `/dispatch`.

**Cadence (decided 2026-09-20)**: monthly, first weekend, plus event-triggered specials for an Alphabet earnings call and a CPUC quarter landing. Quiet months still send; sections with nothing new say why in a derived line.

### 6.1 Domain and sending identity

**Background**: pulled forward from v2 5.2. Resend requires a verified sending domain (SPF, DKIM), so the custom domain can no longer wait for launch week.

**Do**: owner chooses and registers the domain (open decision 1); Vercel domain and DNS; `NEXT_PUBLIC_SITE_URL`; Supabase Auth Site URL and redirect allowlist; magic-link retest against the new domain in a real browser; Resend domain verification; a project-domain contact address replacing the gmail in `methodology_body` if the owner wants one. The `SITE_PUBLIC` gate stays closed.

**Acceptance**: site serves on the custom domain, still noindexed; admin login works end to end; a Resend test email from the domain passes SPF and DKIM.

### 6.2 Subscribers

**Do**:
- Migration (show SQL first), `subscribers`: `id` uuid pk, `email` citext unique, `status` 'pending' | 'confirmed' | 'unsubscribed' | 'bounced', `confirm_token`, `unsubscribe_token`, `confirmed_at`, `unsubscribed_at`, `source_path` (which page the signup came from), `created_at`. RLS: no anon access; all writes through server actions with `supabaseAdmin`. This is the first table holding personal data; say so in `schema.md`.
- Subscribe form: footer and `/dispatch`. Copy states the cadence and that issues are AI-assembled from reviewed data. Honeypot field and a per-IP rate limit; no CAPTCHA unless abuse appears.
- Double opt-in: confirmation email via Resend, tokenized confirm route, tokenized one-click unsubscribe route, `List-Unsubscribe` and `List-Unsubscribe-Post` headers on every send. Unsubscribe never requires login and takes effect immediately.
- CAN-SPAM: every email carries a physical mailing address. The owner provides one (open decision 2); do not ship sends without it.
- Admin: `/admin/subscribers` with counts by status and a CSV export. No individual open tracking surfaced per person.
- Privacy paragraph added to `/methodology` (what is collected, that it is never sold, how to leave).

**Acceptance**: browser-verified signup, confirm, and unsubscribe flows; an unconfirmed address never receives a dispatch; anon cannot read the table (extend `scripts/test-rls.ts`).

### 6.3 The generator

**Do**:
- Migration (show SQL first), `dispatch_issues`: `id`, `issue_number`, `slug`, `kind` 'monthly' | 'special', `period_start`, `period_end`, `status` 'draft' | 'approved' | 'sent', `title`, `facts` jsonb (the structured payload), `body_markdown`, `model`, `tokens_in`, `tokens_out`, `generated_at`, `sent_at`, `recipient_count`. Anon reads `sent` issues only.
- **Collector (`lib/dispatch/collect.ts`, deterministic, no model).** Builds the facts payload for a window from: `audit_log` inserts and updates on `cities`, `disclosed_metrics`, `competitor_snapshots`, `fleet_snapshots`, `milestones`, `financial_periods`, `ride_estimates`; `waymo_mentions` approved in the window (the earnings tables are not on the audit trigger, so this reads `reviewed_at` or equivalent; add the column in this migration if absent); and calendar math for the closing section. Each fact carries its row id, its source URL, and its public permalink. Edits that change no public-facing value are dropped. An update that corrects a previously published value is classified as a correction.
- **Sections, fixed order**: New markets; New data; Earnings; Vehicles and fleet; Regulatory and safety; Corrections (omitted when empty; the only section that is); What to watch. An empty section renders a derived line ("No Alphabet earnings this month. Q3 results are expected in late October."), consistent with how `/earnings` treats silence. Expected earnings dates need a source: surface whether a small hand-maintained `lib/earnings-calendar.ts` is acceptable (open decision 3).
- **Writer.** Numbers, names, dates and links are templated from the payload. The model writes one short framing paragraph per non-empty section and a two-sentence opening, given only that section's facts. Tone: dispatch, flat and specific, no thesis. No em dashes (validated, since this is programmatically generated copy).
- **Fidelity check (principle 11).** After generation, every number, company name, city name and date in the model's prose must match a value in the facts payload. A failure regenerates once, then falls back to the templated lines alone and flags the issue in the preview. Unit tested with an injected fake model, the 4.4 pattern.
- Every issue carries a standing line: assembled by a model from data the editor reviewed, with a link to the methodology, and the footer legal disclaimer.
- **Preview and send.** `/admin/dispatch`: drafts list; an issue preview rendering exactly what subscribers get; the prose is editable, the templated facts are not (fix the data, then regenerate). "Send" is a deliberate click, never automatic. Sending runs as a GitHub Actions dispatch in batches through Resend, not inside a Vercel function, per the long-admin-work convention. A send is idempotent per (issue, subscriber).
- **Triggers.** First Saturday of the month: draft generated, Slack message with the preview link. Specials: when an Alphabet call event flips to `reviewed`, or a new CPUC quarter lands, Slack offers a one-click special draft; nothing drafts or sends on its own.

**Acceptance**: a draft for a real past window contains only facts present in the database, each linked; the fidelity check rejects a fixture with an invented number; an empty month produces a complete, honest issue; a test send reaches a seed list of the owner's addresses with working unsubscribe; per-issue cost logged.

### 6.4 The archive

**Do**: `/dispatch` (issues newest first, subscribe form on top) and `/dispatch/[slug]` (the issue, same content as the email, with sources linked and a permalink per section). ISR, reads through `lib/supabase/public.ts`, sent issues only. Add a `dispatch` kind to `/api/og/[kind]/[id]`. RSS at `/dispatch/feed.xml` (this audience uses readers). Nav link. A one-line latest-issue pointer on the homepage; surface the placement before building.

**Acceptance**: browser-verified; drafts are not reachable by anon at any URL; OG card renders for an issue; feed validates.

### 6.5 Analytics

**Do**:
- `@vercel/analytics` in the root layout. Cookieless, so no consent banner. Before building on custom events (subscribe conversions), check the current Hobby-tier event limits and whether custom events need Pro; surface the finding. Note for the ledger: Vercel Hobby is for non-commercial use, which matters the day the dispatch or the site is monetized.
- Resend webhooks (delivered, opened, clicked, bounced, complained) into an aggregate per issue on `dispatch_issues`; bounces and complaints update `subscribers.status`. Aggregates only.
- `/admin` tiles: confirmed subscribers, net change over 30 days, last issue's open and click rate, top signup source path.

**Acceptance**: a page view and a test subscribe appear in Vercel Analytics; a test send's delivery and open appear on the issue; a simulated bounce flips the subscriber's status.

### 6.6 Back issues and ship checkpoint

**Do**: generate issues for the completed months since the August resumption from real `audit_log` history, each labeled as assembled retrospectively on its actual generation date. The owner reviews and publishes them to the archive without sending. Send issue one to the seed list. Deploy; update `architecture.md`, `schema.md`, `pre-launch.md`.

**Acceptance**: at least two issues in the archive (announce bar item d); seed-list send verified in a real inbox, including the unsubscribe link and the mailing address.

---

## Phase 7: Launch

**Ships publicly**: this phase is the announcement.

### 7.1 Indexing infrastructure

sitemap.xml (including `/dispatch` issues and `/earnings` permalinks), robots.txt, per-section OG images by adding kinds to `/api/og/[kind]/[id]` (landing, landscape, financials, milestones, methodology), Schema.org markup (Article on editorial sections and dispatch issues, Dataset on data sections), titles and meta descriptions per v1 8.1 keyword targets plus landscape terms ("robotaxi comparison", "Zoox vs Waymo", "AV deployment tracker"). Confirm one OG card in a real share debugger; it has never been rendered by a deployment.

### 7.2 Final freshness and correctness pass

Latest CPUC quarter present; every landscape snapshot as-of within a quarter; implied P&L reflects the latest reported Alphabet quarter; the inbox is empty; the latest dispatch is under five weeks old; placeholder copy sweep (`// TODO: user to replace` and every seeded `site_content` key); the full `pre-launch.md` checklist; Lighthouse (95+ performance, 100 accessibility); one Playwright smoke test per public route.

### 7.3 Flip and announce

`SITE_PUBLIC=true` in Vercel production; redeploy; verify noindex headers and meta robots are gone; submit the sitemap to Google Search Console. The owner announces (LinkedIn and Alpha Work are the owner's to write; offer drafts), with the subscribe form as the call to action. First-week monitoring: Slack for scraper and monitor failures, Vercel logs, signup and confirmation rates, Resend bounce and complaint rates.

**Acceptance**: site indexed, announcement out, no stale data visible on day one, subscribe flow healthy under real traffic.

---

## Phases 8 to 10: Post-announce roadmap

Heading level only; each gets a full module breakdown at phase start, written into this document (not deferred to v1 text).

**Phase 8: Unit economics.** Assumptions table (extending 4.9's `model_assumptions`), cost-per-mile waterfall, revenue per ride, interactive calculator with shareable URL state and "Waymo baseline" and "China cost structure" presets (Pony's claimed per-vehicle breakeven, Apollo Go's RT6 cost, WeRide's per-vehicle revenue projection as disclosed anchors), city breakeven. On completion, wire COGS into the implied P&L, closing the Phase 4 simplification.

**Phase 9: Safety.** CPUC `incident_metrics` ingestion, NHTSA SGO monthly scrape (Waymo, Zoox, Tesla: comparative safety is the editorial hook), CA DMV disengagement reports, dashboard with human-baseline comparisons and methodology critique, maintained recall timeline. NHTSA recalls already arrive as milestones through the Phase 5 monitor; this phase adds the structured series.

**Phase 10: Outlook, valuation, polish.** Bull and bear cases with explicit probabilities, valuation framework and scenario builder, share-this-chart PNG generation, methodology changelog. (Email capture, formerly here, shipped in Phase 6.)

---

## Decisions log

Decided 2026-09-20 (v3 planning):
- Dispatch lives on the site; Substack rejected (see "What changed").
- Review gate: one unified inbox, weekly; approval publishes and queues for dispatch.
- Staging table (`proposed_changes`) over per-table draft flags.
- Auto-approve: CPUC filings and `waymo.com` roster membership only. SEC table figures and NHTSA recalls wait for review.
- News: model-assisted monitor over first-party sources, plus quick-add by URL.
- Cadence: monthly plus specials for Alphabet calls and CPUC quarters.
- Email provider: Resend. Analytics: Vercel Web Analytics.
- Milestones feed: industry-wide.
- `build-log.md` split adopted; the August briefing archived as `briefing-2026-08.md`.
- The uncommitted 4.12 wrap-up ships in the v3 commit.

Carried from v2 (all resolved): CPUC series kept and scraper rebuilt direct; national disclosed-metrics series in Phase 2; 'employee' city status added (0009); announced cities included only where dated or operating; landscape map built as a separate lighter component (`OperatorMap`); minor operators included, Nuro/Lucid/Uber modeled with roles; extraction model `claude-sonnet-5`, Anthropic API retained with `ModelCaller` as the seam for alternatives; Motley Fool as transcript source; Zoox CPUC pilot data ingested from xlsx.

## Open decisions

1. **Custom domain** (6.1): needed before any email sends. Owner chooses and registers.
2. **Mailing address for CAN-SPAM** (6.2): a PO box or registered-agent address; owner provides.
3. **Expected earnings dates** (6.3): hand-maintained calendar file vs. deriving from prior-year dates.
4. **Homepage milestones weighting** (5.3): Waymo-weighted vs. strictly most-recent.
5. **`financial_periods` segment column** (4.8): column vs. convention. Recommendation: column.
6. **Rides between disclosures** (4.9): step, linear, or CPUC-shaped interpolation.
7. **Two figures in one mention** (4.14): allow splitting vs. document the limit.
8. **Recurring IR transcript fallback** (4.13): build a parser for abc.xyz vs. manual ingest when Fool skips a quarter.
9. **Employer and compliance check** (before 7.3): the owner holds a Series 65 and works at a corporate venture arm; a public, recurring, AI-assembled publication about investable companies is worth one conversation about outside-activity policy and disclaimer wording before the announcement. Owner's call.

## Cross-cutting requirements

Carried over unchanged: no em dashes anywhere (this document, UI strings, generated dispatch copy, emails, commit messages); ISR with on-demand revalidation on admin writes; scraper etiquette (robots.txt, `SCRAPER_USER_AGENT`, 2-second delays, raw documents to Storage); the footer legal disclaimer (also on every dispatch email); WCAG AA; fixture-based tests for scrapers, monitors, and the generator; smoke tests per route.

Amended: "new scraped data lands as `pending_review`" now reads: model-drafted and unreviewed material lands in `proposed_changes` (or `waymo_mentions` pending) and is never public until approved; regulator files parsed by code and roster membership publish on arrival, per the auto-approve tiers in Phase 5.

Working agreement per `CLAUDE.md`, unchanged: module by module, no chaining, commit per module, show migrations and non-trivial component structures before building, browser verification for anything touching auth or routing, flag rather than deviate, never fabricate data, `architecture.md` maintenance block every module. Added: build narrative is appended to `build-log.md` in the same commit; this file changes only when scope, sequence, or a decision changes.

## Effort estimate

| Phase | Scope | Effort (weekends) |
|---|---|---|
| 0 | Section 0 housekeeping and catch-up | 0.5 |
| 4 (rest) | 4.13, 4.8, 4.9, 4.10, 4.14 | 2 to 3 |
| 5 | The Desk | 2 to 3 |
| 6 | Dispatch | 2 to 3 |
| 7 | Launch | 1 |
| 8 | Unit economics | 3 |
| 9 | Safety | 2 |
| 10 | Outlook, valuation, polish | 2 to 3 |

Roughly 8 to 10 weekends to announcement. v2 estimated 8 to 11 from mid-August and the first three phases consumed about that in elapsed sessions, so treat this as a floor. The trade v3 makes: two more phases before launch, in exchange for a site that stays fresh on ten minutes a week and an audience that hears about it monthly.

## How Claude should work through this plan

Read `CLAUDE.md`, `architecture.md`, `schema.md`, and this document before starting any module; read the relevant `build-log.md` entries before changing anything a finished module built. Work module by module. After each: summarize, update `architecture.md` and `build-log.md` in the same commit, propose the commit message, wait for approval. Do not chain modules. The plan changes through the owner, never silently.
