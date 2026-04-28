# CLAUDE.md

Project memory for Claude Code. Read this at the start of every session, before reading `dev-plan.md`.

## Project

**The Empty Seat** is a research-grade website about Waymo, targeting growth investors and competitive AV companies. It is a greenfield build in this repo; there is no legacy code to preserve. The full build specification is in `dev-plan.md`.

The tone is editorial research, not product marketing. Think "essay you can live inside" rather than "dashboard." Restrained typography, generous whitespace, serif display headlines, narrative around every chart.

## Tech stack (fixed)

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4 (CSS-based `@theme` config, no tailwind.config.ts), Recharts, Framer Motion
- **Hosting**: Vercel
- **Database**: Supabase (Postgres, Auth, Storage)
- **Background jobs**: Vercel Cron for light work, GitHub Actions for heavier scrapes
- **LLM extraction**: Anthropic API (Claude Sonnet 4, `claude-sonnet-4-20250514`)
- **Maps**: Mapbox GL JS
- **Tooltips, dialogs, menus**: Radix UI primitives
- **Monitoring**: Vercel logs + Slack incoming webhook for scraper failures

Do not substitute any of these without asking first. If a package required for a task doesn't exist or has been deprecated, surface the question rather than installing an alternative.

## Tailwind v4 config note

Tailwind v4 uses CSS-based configuration via `@theme` in the global CSS file (e.g., `app/globals.css`) rather than a `tailwind.config.ts` file. Module 0.4 applies the editorial theme (fonts, colors, spacing) there. Dev-plan references to `tailwind.config.ts` should be read as applying to `globals.css` instead.

## Architecture principles

- **Multi-company data, Waymo-only frontend.** Every data table has a `company_id` foreign key, but every public-facing page in the scope of this plan is Waymo-only. Do not build generic "company page" components or a company switcher UI.
- **Research over dashboard.** Every chart is wrapped in narrative. Raw data without framing is not the product.
- **Primary sources always linked.** Every non-trivial data point traces to a row in the `sources` table.
- **Tooltips everywhere.** Use the `<Tooltip>`, `<Metric>`, and `<Term>` components built in Phase 0 for every metric, acronym, and methodology assumption. Centralize definitions in `lib/glossary`.
- **Static where possible.** ISR with revalidation on admin writes. Don't make things dynamic without a reason.
- **Admin UX matters.** If data entry is painful, the site goes stale. Budget 20% of every phase for admin ergonomics.

## Working agreement

- **Work module by module.** The dev plan is organized into phases (0 through 8), each with numbered modules (e.g., 0.1, 0.2, 0.3). Do one module at a time. After each module, summarize what was built, propose the next commit message, and wait for my approval before starting the next module.
- **Do not chain modules.** Even if the next module looks simple, stop and check in.
- **Commit per module.** Clean, descriptive commit messages. One module per commit when practical. No em dashes in commit messages; use colons or commas.
- **For auth, routing, and redirect modules: verify in a browser, not just build/lint.** Build and lint cannot catch redirect loops or auth flow bugs. Any module that touches middleware, layout-level auth checks, or login/callback routes must be tested end-to-end in a browser before proposing a commit. (Reference: module 0.6 had a redirect loop on /admin/login caused by the admin layout applying to the login page itself. Build passed; the loop was only visible in a browser.)
- **Surface ambiguity.** If a detail is missing or ambiguous, ask. Small defaults (variable names, minor file structure decisions, import ordering) are fine to decide autonomously. Anything user-facing or architectural gets surfaced.
- **Show before you build.** For non-trivial new components, propose the structure and dependencies first. For database schema changes, show the migration SQL before applying.
- **Flag, don't deviate.** If something in the dev plan seems wrong or incomplete as you work, stop and flag it. The plan is the source of truth; changes come from the user.
- **When data is needed that isn't seeded.** If a phase requires content the user hasn't provided (specific milestone entries, specific city launch dates, real financial figures), ask for it rather than fabricating. For development-time seed data, it is acceptable to use clearly marked placeholder values (e.g., `-- PLACEHOLDER: user to replace`) but never ship placeholders to production without explicit approval.

## Style and voice

- **No em dashes anywhere, including commit messages.** This applies to UI strings, tooltip text, glossary definitions, editorial copy, programmatically generated content, and git commit messages. Use commas, semicolons, colons, or parentheses. This is a firm rule.
- **Editorial, not marketing.** Specific, confident, restrained.
- **Typography**: serif display (suggest Fraunces or Instrument Serif), clean sans for body (suggest Inter).
- **Color palette**: off-white background (`#FAFAF7`), near-black text (`#0A0A0A`), one restrained accent (deep blue or forest green, around `#1E3A5F`).
- **Copy placeholders**: any placeholder copy Claude Code drafts during a build should be marked with a comment like `// TODO: user to replace with final copy` so it's easy to find before ship.

## Data and scraper etiquette

- Every scraped source must respect robots.txt.
- Use the `SCRAPER_USER_AGENT` env var (format: `TheEmptySeat/1.0 (contact@email.com)`) on every outbound HTTP request.
- Minimum 2-second delay between requests to the same source.
- Raw scraped documents go to Supabase Storage so extraction can be re-run.
- New scraped or extracted data lands as `pending_review` (or equivalent draft state) and is not public until the admin approves.

## Database workflow

- **Applying schema changes**: `supabase db push --include-seed` applies the migration and seed together against the linked project.
- **`supabase/seed.sql` is for bootstrap data only**: the 6 company rows and any other structural reference data needed before the admin UI exists. Admin-entered content (cities, milestones, financials, etc.) lives only in the live database and is never written into `seed.sql`.
- **New migrations**: add a new numbered file to `supabase/migrations/` (e.g., `0002_...sql`). Never edit a migration that has already been pushed.
- **RLS**: the `is_admin()` function checks `app_metadata.is_admin` in the Supabase JWT. To grant admin access to a user: `auth.admin.updateUserById(id, { app_metadata: { is_admin: true } })` via the service-role client or the Supabase dashboard (Authentication > Users > edit user).
- **Audit trigger limitation**: `audit_trigger_fn()` (defined in `0001_initial_schema.sql`) is hard-coded to read `NEW.id`, so it only works on tables with a UUID `id` column. Tables with non-UUID primary keys (e.g., `site_content`, which uses `key text` as PK) cannot use the audit trigger as-is. Three options when this comes up again: (1) skip the audit trigger on the table (acceptable for config or copy tables, less so for analytical tables); (2) generalize `audit_trigger_fn()` in a future migration to handle arbitrary primary keys via `to_jsonb(NEW)`; (3) add a UUID `id` column to the new table with the natural key as a unique constraint. `site_content` uses option (1). When a future non-UUID table is needed, surface and decide before writing the migration.
- **Show migration SQL before applying**: every migration, no matter how small, must have its full SQL shown to the user and approved before the file is written and `supabase db push` is run. This applies to fix migrations as well as feature migrations. (Reference: migration 0003 was pushed after only a prose description, not a SQL review.)

## Architecture maintenance

`architecture.md` is the living snapshot of the repo state. It is updated at the end of every module that changes schema, routes, components, conventions, integrations, or debt, in the same commit as the module work. The maintenance block below is appended to every module prompt and should be followed even when a module prompt forgets to include it:

ARCHITECTURE UPDATE (do this in the same commit as the module work)
After browser verification passes and before proposing the commit:

  1. Open architecture.md and update every section affected by this
     module: new or changed tables (Schema), new routes (Routes), new
     or changed components (Components), new lib files or integrations
     (Libraries), any new conventions codified (Conventions), any new
     debt or resolved debt items (Known gaps and debt), any new parking-
     lot items (Parking lot), and the file structure appendix if new
     directories or files were added. Also update the Migration history
     line in Cross-cutting schema notes if this module added a migration.

  2. Update the "Last updated" header:
       Module: <this module number, e.g. 1.3>
       Date: <today's date YYYY-MM-DD>
       Commit: <module> work  (e.g. "1.3 work")

  3. Confirm the file stays under 500 lines (`wc -l architecture.md`).
     Note: wc -l counts blank lines, so practical content is closer to
     380 lines of text. If the file is at or above 480 lines, stop and
     surface before committing so we can consolidate together rather
     than silently going over.

  4. Stage architecture.md alongside all other module files in the
     same commit. Do not make a separate commit for the architecture
     update.

## Security rules

- Never commit `.env.local` or any file containing API keys, service role keys, or secrets.
- Never import `lib/supabase/admin.ts` (service role client) into a client component. It is server-only.
- Never expose admin routes to unauthenticated users. The auth gate lives in `app/admin/(protected)/layout.tsx` (a route group that wraps all admin pages except `/admin/login`). The outer `app/admin/layout.tsx` is a plain passthrough with no auth check, so the login page remains publicly accessible.
- **Admin auth model:** the `(protected)` layout gates on session existence only (any authenticated user). All admin mutations use `supabaseAdmin` (service role client), which bypasses RLS. The `is_admin()` DB function exists for RLS on the regular session client but is not enforced at the UI layer. Onboarding an admin user requires only that they can receive a magic link to their email: no special claim is needed. If a second admin with restricted write access is ever needed, add an `is_admin` claim check to `(protected)/layout.tsx`.
- Never deploy to production without explicit user approval.

## First session

When the user says "start Phase 0":

1. Read `dev-plan.md` in full.
2. Confirm understanding of Phase 0 scope, all modules (0.1 through 0.7).
3. Note any missing information or ambiguity (for example: Supabase project credentials, custom domain, Slack webhook URL, Mapbox token, Anthropic API key). Ask for what's needed before starting.
4. Begin Phase 0, module 0.1 only. Stop when 0.1 is complete and propose the commit message.

## Phase 0 status

Phase 0 is complete as of April 2026. All 7 modules shipped and verified.

**What is live:**
- Supabase schema: all tables from `dev-plan.md` with RLS policies, `is_admin()` function, and audit log triggers on every table
- Admin shell: magic link login, `(protected)` route group gating, CRUD for all 7 tables (companies, cities, milestones, sources, fleet_snapshots, ride_estimates, financial_periods), milestone publish toggle
- Design system: editorial `@theme` in `globals.css`, Fraunces serif + Inter sans loaded via `next/font/google`, Container, Prose, Heading, Button, Card primitives, PageShell with sticky nav and footer
- Tooltip system: Radix UI Tooltip wrapper with mobile tap-to-reveal and 8-second auto-dismiss, Metric component with info icon, Term component with dotted underline, central glossary with 12 terms
- Error monitoring: `lib/notify.ts` with graceful no-op when `SLACK_WEBHOOK_URL` is unset, daily health-check cron at `/api/cron/scraper-health` protected by `CRON_SECRET`

**What is deferred to later phases:**
- Real scrapers (Robotaxi Tracker, SEC EDGAR, Motley Fool transcripts): Phase 1.3 and Phase 4
- Cron secret rotation before production deployment: do this before Phase 1.6 ship
- Dedicated production Slack channel (vs. dev channel): set up before Phase 1.6 ship
- `is_published` trigger for public-page ISR revalidation: needed in Phase 1 when public pages actually render data

**Working agreement refinements from Phase 0:**
- Per-module commits, no chaining modules even when the next looks trivial
- Auth and routing modules must be verified via a real browser flow before proposing a commit; build and lint cannot catch redirect loops (reference: 0.6 redirect loop on `/admin/login`)
- No em dashes in commit messages, same as user-facing content; use colons or commas
- Tailwind v4 config lives in `globals.css` under `@theme`, not in `tailwind.config.ts`
- Next.js 16 uses `proxy.ts` with a `proxy` export instead of `middleware.ts`

## Maintenance of this file

`CLAUDE.md` is a living document. If patterns emerge during the build worth preserving (preferences the user has stated, conventions that have been adopted, rules that have come up), add them here with the user's approval. Keep the file tight; it's the reference card, not the full spec.
