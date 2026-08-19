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
  landscape_regulatory, landscape_methodology) reviewed and finalized
  via `/admin/site-content`. Added 3.5.
- [ ] **Competitor snapshot freshness.** Every `competitor_snapshots`
  row less than one quarter old at launch; Apollo Go and Pony.ai refreshed
  after their 2026-08-18 Q2 earnings. Added 3.5.
- [ ] **Types regeneration.** `supabase gen types typescript --linked >
  lib/supabase/types.ts` run and committed after all migrations through
  0011 are pushed. Added 3.5.

- [ ] **City date corrections.** Nashville `public_access_date` is 2026-04-07
  but Waymo opened it to everyone on 2026-06-25; April 7 was the waitlist
  launch (source: support.google.com/waymo/answer/17200563). Los Angeles has
  `launch_date` = `public_access_date` = 2024-11-12, which collapses a
  waitlist period that grew to 300,000 people before the drop; the waitlist
  start date needs a primary source. Both distort CityLaunchTimeline. Added
  2026-08-16 from the waymo.com roster spot-check.

## Open

Add new items here as they surface between now and launch.
