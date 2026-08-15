// scripts/seed-landscape-content.ts
// Module 3.3: seeds the three admin-editable site_content keys used by the
// landscape page (landscape_intro, landscape_china, landscape_regulatory, landscape_methodology)
// with the same placeholder copy the page falls back to, so the user can
// edit in /admin/site-content rather than in code. Idempotent upsert; does
// NOT overwrite a key that already exists (user edits win).
//
// Run with: npx tsx scripts/seed-landscape-content.ts

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// TODO: user to replace with final copy (edit via /admin/site-content)
const CONTENT: Record<string, string> = {
  landscape_intro: `The robotaxi field is no longer a one-company story, but it is still a lopsided one. Waymo carries roughly half a million paid riders a week across eleven US metros. Everyone else in the United States is either just charging its first fares, running with a safety operator, or not yet open to the public at all. In China, Baidu's Apollo Go runs a comparable weekly volume at a fraction of the vehicle cost, and three Chinese operators are exporting driverless service to the Gulf and Europe faster than any American operator.

This page tracks each program at the fidelity its own disclosures allow. Where a company files with a regulator, the number is labeled as such. Where the only figure available is an analyst's reading of a company chart, that is labeled too. Blank cells are deliberate: an operator that has not disclosed a fleet size has told you something.`,

  landscape_china: `The Chinese operators run a different game. Baidu's Apollo Go reported 3.2 million fully driverless rides in the first quarter of 2026, a weekly peak above 350,000, on a purpose-built RT6 that Baidu says costs about $28,000 to build. Pony.ai claims per-vehicle unit-economics breakeven in Guangzhou on its seventh-generation kit and puts its vehicle cost at a quarter to a fifth of Waymo's. WeRide says its Abu Dhabi operation turned operationally profitable after removing safety officers.

Two caveats travel with those numbers. Chinese fares are lower, so ride counts do not translate to comparable revenue. And the industry hit a wall this spring: a mass outage that froze roughly a hundred Apollo Go vehicles on Wuhan streets in March triggered a nationwide freeze on new permits from April to late July, and Wuhan resumed with safety drivers back in the cars.

The more consequential development for US observers is the export. Apollo Go and WeRide run driverless commercial service in Dubai and Abu Dhabi on the Uber app; Pony.ai operates in Zagreb, Doha, Singapore, and Seoul and has committed 2,000 vehicles across five European cities with Uber. Uber is the common rail for nearly every non-Waymo operator on earth, which is a fact about Uber as much as about any of them.`,

  landscape_regulatory: `The most honest comparison available in the United States comes from the California Public Utilities Commission, which requires every permitted operator to file the same quarterly data template. Waymo files in the Deployment tier (paid public service). Zoox files in the Pilot tier (passengers allowed, fares not), and Nuro joins the Pilot tier from the second quarter of 2026. Same regulator, same columns, same cadence.

The gap is enormous and the chart does not hide it: Waymo completed roughly 3.9 million California trips in the first quarter of 2026; Zoox completed about 23,000. But the shape of Zoox's line matters more than its level. Its monthly driverless trips doubled across the quarter, from 5,219 in January to 10,685 in March, before it had charged a single fare. When Nuro's first filing lands, the same chart will show whether the Uber program is following that curve.`,

  landscape_methodology: `Every figure on this page is a point-in-time reading with a stated disclosure quality: a regulatory filing, an earnings disclosure, a company statement, press reporting, or an estimate. Blank cells mean the operator has not disclosed the figure. Third-party figures are never used for headline claims. Sources are linked from each disclosure badge and cataloged on the sources page. Snapshots are updated as new disclosures land; the as-of date on each row is the date of the underlying disclosure, not the date it was entered here.`,
};

async function main() {
  for (const [key, markdown_body] of Object.entries(CONTENT)) {
    const { data: existing } = await client.from("site_content").select("key").eq("key", key).maybeSingle();
    if (existing) {
      console.log(`skip ${key} (exists; user edits win)`);
      continue;
    }
    const { error } = await client.from("site_content").insert({ key, markdown_body });
    if (error) {
      console.error(`FAIL ${key}:`, error.message);
      process.exit(1);
    }
    console.log(`OK   ${key}`);
  }
  console.log("Done.");
}
main();
