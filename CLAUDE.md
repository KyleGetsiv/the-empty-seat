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

## Maintenance of this file

`CLAUDE.md` is a living document. If patterns emerge during the build worth preserving (preferences the user has stated, conventions that have been adopted, rules that have come up), add them here with the user's approval. Keep the file tight; it's the reference card, not the full spec.
