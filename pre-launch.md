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

## Open

Add new items here as they surface between now and launch.
