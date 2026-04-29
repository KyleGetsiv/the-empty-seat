import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // env vars may already be set in the shell
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const METHODOLOGY_BODY = `<!-- TODO: user to replace with editorial framing of why this methodology page exists. One paragraph. -->

## Data Sources

### CPUC Quarterly Filings

The California Public Utilities Commission requires all permitted autonomous vehicle operators to file quarterly reports covering trip volumes, vehicle miles traveled, and incident data. These filings are the most granular publicly available data on Waymo's California operations.

We extract the following from each quarterly filing: total trips completed, vehicle miles traveled (zero-emission vehicles only), and the reporting period. Fleet counts and drivered-vehicle data are subject to confidentiality claims and are partially redacted in public releases; we do not publish redacted figures.

The CPUC publishes filings quarterly with a lag of approximately six weeks after the period ends. Our scraper checks for new filings weekly and processes them automatically.

**Limitations:** California operations only. Fleet sizes are redacted. No per-city breakdown of trip volumes is available from this source. Data represents fulfilled commercial trips only; testing miles are reported separately and are not included.

### Waymo Blog

Waymo's official blog at waymo.com is the primary source for city launch announcements, partnership announcements, and milestone disclosures. Entries on the Milestones page are sourced from individual blog posts, press releases, or regulatory filings and are entered by the editor after review.

**Limitations:** Company-authored content; qualitative claims are not independently verified. Waymo does not disclose operational data (ride volumes, fleet sizes, financials) through its blog.

### Robotaxi Tracker

[Robotaxi Tracker](https://robotaxitracker.com) aggregates community-spotted sightings of autonomous vehicles across multiple cities and operators. For readers who want live, community-tracked granularity across all Waymo cities, it is the best available resource.

Robotaxi Tracker is not a backend data source for this site. Its data consists of community sightings rather than disclosed operational figures, and its terms restrict automated API access. The quantitative metrics on this site are sourced exclusively from official regulatory filings; Robotaxi Tracker is listed here so readers know where to find the complementary community view.

## Update Frequency

| Source | Publication lag | Site update |
|--------|----------------|-------------|
| CPUC quarterly filings | Approximately 6 weeks after quarter end | Checked weekly; updated automatically when new filings appear |
| Waymo blog and press releases | Immediate | Manually entered by editor, typically within a week of publication |
| City data | Continuous | Updated manually when Waymo announces changes |

## Limitations

This site tracks only what primary sources disclose. There are several things this site cannot show, because no public source reports them:

- **California operations only for quantitative data.** The CPUC is the only state regulator publishing per-quarter trip volumes for Waymo. Operations in Texas, Arizona, and other states appear in the city launch timeline but not in trip volume or mileage metrics.
- **No fleet size data.** CPUC quarterly filings redact vehicle counts. Fleet estimates circulate in the press but are not published here because they cannot be independently verified from a primary source.
- **No per-city ride volumes.** Neither Waymo nor any regulator publishes per-city ride volumes. All quantitative trip data on this site is California-wide.
- **Sparse pre-2025 baseline.** Quarterly trip data currently covers Q1 through Q4 2025. Pre-2025 CPUC filings exist but require a separate extraction pipeline not yet built.

<!-- TODO: user to replace with methodology principles for estimated data. Phase 1 has minimal estimation (most data is disclosed), but Phase 2 onward introduces assumptions. Reserve the section now. -->

## Contact

Spotted an error or have data we should track? Email [placeholder@example.com](mailto:placeholder@example.com).

<!-- TODO: 1.6 replace with real email before ship -->

## Changelog

<!-- TODO: user to replace; track methodology updates here. -->
- 2026-04-28: Methodology page initial publication.

---

For a complete list of every primary source cited on this site, see the [sources page](/methodology/sources).
`;

async function main() {
  const { error } = await supabase.from("site_content").upsert(
    { key: "methodology_body", markdown_body: METHODOLOGY_BODY },
    { onConflict: "key" }
  );

  if (error) {
    console.error("Failed to upsert methodology_body:", error.message);
    process.exit(1);
  }

  console.log("Upserted site_content key: methodology_body");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
