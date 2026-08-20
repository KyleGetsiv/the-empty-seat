# pre-launch.md

Checklist of items to complete before flipping The Empty Seat from
undiscoverable to publicly indexable. Tracked separately from
`architecture.md` to keep that file inside its 500-line budget.

Each item is the "why this matters at launch" version of work that has
been deferred; cross-reference `architecture.md` for the surrounding
context.

## Items

- [ ] **Flip discoverability gate.** Set `SITE_PUBLIC=true` in Vercel
  Production env and redeploy. This drops the `X-Robots-Tag` header from
  `proxy.ts` and removes the `<meta name="robots">` emitted by root
  `generateMetadata`.
- [ ] **Custom domain.** Configure custom domain in Vercel project
  settings; add DNS records at the registrar; verify both apex and `www`
  resolve.
- [ ] **Supabase Site URL.** Update Supabase Auth Site URL to the custom
  domain. Add the custom domain to the Redirect URLs allowlist; keep the
  localhost wildcard for local dev.
- [ ] **Methodology contact email.** Replace `getsivkyle@gmail.com` in
  `methodology_body` with a project-domain address if one is set up.
  Edit via the admin UI at `/admin/site-content/methodology_body`.
- [ ] **Indexing hygiene.** Confirm OG image route, `sitemap.xml`, and
  `robots.txt` behave correctly once the gate flips. None of these exist
  yet; they need to be built before launch.
- [ ] **Magic-link click-through retest.** After the custom domain swap,
  re-verify admin magic-link login end-to-end against the new domain.

- [ ] **Placeholder copy sweep.** Every `// TODO: user to replace`
  block and every seeded `site_content` key (thesis_paragraphs,
  methodology_body, landscape_intro, landscape_china,
  landscape_regulatory, landscape_methodology, earnings_intro,
  earnings_methodology) reviewed and finalized via
  `/admin/site-content`. Added 3.5; earnings keys added 4.6a, and
  neither row exists yet, so both pages currently render their inline
  fallback copy.
- [ ] **Duplicate SCRAPER_USER_AGENT in `.env.local`.** The key is
  defined twice (lines 7 and 17). Whichever the parser reads last
  wins, so the user agent actually sent to SEC EDGAR may not be the
  one intended, and EDGAR's fair-use policy expects a real contact
  string. Delete the stale line and confirm which value is live.
  Found by the 4.6b architecture accuracy pass.
- [ ] **Competitor snapshot freshness.** Every `competitor_snapshots`
  row less than one quarter old at launch; Apollo Go and Pony.ai refreshed
  after their 2026-08-18 Q2 earnings. Added 3.5.
- [ ] **Types regeneration.** `supabase gen types typescript --linked >
  lib/supabase/types.ts` run and committed after all migrations through
  0013 are pushed. Hand-patched for 0006 through 0013 in the meantime.
  Added 3.5, updated 2026-08-19.
- [ ] **Reprocess button never exercised.** `/admin/earnings/[id]` renders
  its reprocess control disabled because `GITHUB_DISPATCH_TOKEN` is unset,
  so one of module 4.5's deliverables has never run. Needs a fine-grained
  PAT with Actions read and write, set in Vercel and `.env.local`, then one
  dispatch confirmed end to end. Added 2026-08-19.
- [ ] **Post-fix chart verification.** Confirm `DisclosedRidesChart` on the
  homepage renders the corrected weekly-rides arc: nine points, no doubled
  steps, Tiger Global's 450K as an open dot above Waymo's own 400K. The
  fix(4.5) and fix(2.4) scripts wrote straight to the database, so nothing
  was visible until ISR expired. Added 2026-08-19.

- [x] **City date corrections.** (Applied 2026-08-19.) Two Waymo rows collapsed the waitlist period
  into a single date, which CityLaunchTimeline orders and labels from.
  Nashville `public_access_date` should be 2026-06-25, not 2026-04-07 (April
  7 was the rolling-invite launch; source: support.google.com/waymo/answer/
  17200563). Los Angeles `launch_date` should be 2024-03-14, not 2024-11-12
  (Nov 12 is when the 300,000-person waitlist was dropped; service to public
  riders began Mar 14; source: waymo.com/blog/2024/03/scaling-waymo-one-
  safely-across-four-cities-this-year). Fix is written and idempotent:
  `npx tsx scripts/fix-city-dates.ts [--apply]`. Phoenix, Austin and Atlanta
  legitimately share both dates and are left alone. Added 2026-08-16 from the
  waymo.com roster spot-check; corrected the same week.

## Open

Add new items here as they surface between now and launch.
