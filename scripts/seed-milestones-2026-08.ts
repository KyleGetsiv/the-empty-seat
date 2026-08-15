// scripts/seed-milestones-2026-08.ts
// Module 2.5: backfills milestones for May through August 2026 (the hiatus
// window), each with a source row. Facts verified against primary or
// strong secondary sources 2026-08-15. Seeded as published, matching the
// earlier milestone seed precedent; unpublish or annotate via admin.
//
// Idempotent: skips any milestone whose (company, event_date, headline)
// already exists; sources found-or-created by URL.
//
// Run with: npx tsx scripts/seed-milestones-2026-08.ts

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

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SeedMilestone {
  event_date: string;
  headline: string;
  body: string;
  tags: string[];
  source: { url: string; publisher: string; title: string; published_at: string };
}

const MILESTONES: SeedMilestone[] = [
  {
    event_date: "2026-06-16",
    headline: "Waymo issues sixth software recall after freeway construction-zone incidents",
    body:
      "Following 13 documented incidents between April 11 and May 18 in which robotaxis drove through active freeway construction zones at speed, Waymo suspended all freeway operations in May and deployed an over-the-air fix between June 16 and 29. The update, classified as the company's sixth software recall since February 2024, covered 3,871 vehicles. The underlying failure: sensors detected the construction zones, but the planning layer overrode the input.",
    tags: ["safety", "technology"],
    source: {
      url: "https://www.techtimes.com/articles/322163/20260730/waymo-freeways-return-airport-rides-resume-federal-bill-targets-av-safety-gap.htm",
      publisher: "Tech Times",
      title: "Waymo freeways return, airport rides resume, federal bill targets AV safety gap",
      published_at: "2026-07-30",
    },
  },
  {
    event_date: "2026-06-29",
    headline: "Waymo and Uber quietly end their Phoenix pilot",
    body:
      "The roughly three-year Phoenix arrangement that put about a dozen Waymo vehicles on the Uber app ended at contract expiration in May, with the vehicles folded into Waymo's own Phoenix fleet. Reported June 29. The pilot had served hundreds of thousands of trips and was the original template for the deeper Austin and Atlanta partnerships.",
    tags: ["partnership", "operations"],
    source: {
      url: "https://techcrunch.com/2026/06/29/waymo-and-uber-quietly-part-ways-in-phoenix/",
      publisher: "TechCrunch",
      title: "Waymo and Uber quietly part ways in Phoenix",
      published_at: "2026-06-29",
    },
  },
  {
    event_date: "2026-07-08",
    headline: "Driverless operations begin in Las Vegas, Denver, San Diego, and Tampa",
    body:
      "Waymo announced fully autonomous operations in four new metros at once, with employee riders first and public access to follow. The announcement reiterated roughly 500,000 weekly rides and the target of 1 million paid rides per week by the end of 2026, and noted rollout of the 6th-generation Driver on the Zeekr-built Ojai platform alongside Hyundai IONIQ 5 testing.",
    tags: ["new_city", "operations"],
    source: {
      url: "https://waymo.com/blog/shorts/ro-den-lv-sd-tmpa/",
      publisher: "Waymo",
      title: "Waymo begins driverless operations in Las Vegas, Denver, San Diego, and Tampa",
      published_at: "2026-07-08",
    },
  },
  {
    event_date: "2026-07-24",
    headline: "Uber and Waymo to end exclusivity in Austin and Atlanta",
    body:
      "The companies announced their exclusive arrangement in Austin and Atlanta will end in January 2028, when Waymo launches its own app in both markets; Uber-app service continues through May 2028 under the current contract. Uber shares fell more than 4% on the news. Reporting cited friction over economics, safety-incident transparency, and Waymo's preference for direct customer relationships.",
    tags: ["partnership", "financial"],
    source: {
      url: "https://www.cnbc.com/2026/07/24/uber-and-waymo-to-end-exclusivity-arrangement-in-atlanta-and-austin.html",
      publisher: "CNBC",
      title: "Uber and Waymo to end exclusivity arrangement in Atlanta and Austin",
      published_at: "2026-07-24",
    },
  },
  {
    event_date: "2026-07-29",
    headline: "Freeway service resumes, starting with Phoenix",
    body:
      "Two months after the construction-zone suspension, Waymo resumed freeway operations beginning in Phoenix, restoring Sky Harbor airport rides, with Bay Area (SFO and SJC), LA, Miami, and Austin freeway routing to follow within days. Rider-only miles stood at 220.6 million through March 2026, with Waymo citing roughly 94% fewer serious-injury crashes than human benchmarks.",
    tags: ["operations", "safety"],
    source: {
      url: "https://www.techtimes.com/articles/322163/20260730/waymo-freeways-return-airport-rides-resume-federal-bill-targets-av-safety-gap.htm",
      publisher: "Tech Times",
      title: "Waymo freeways return, airport rides resume, federal bill targets AV safety gap",
      published_at: "2026-07-30",
    },
  },
  {
    event_date: "2026-08-04",
    headline: "Dallas drops its waitlist, first of the Texas cohort to reach open access",
    body:
      "Less than six months after the February launch, Dallas became fully open to all riders; roughly 150,000 people had joined the interest list. Houston and San Antonio remain waitlisted. Waymo also flagged Dallas freeway testing and autonomous testing at Love Field as next steps.",
    tags: ["new_city", "operations"],
    source: {
      url: "https://waymo.com/blog/shorts/dallas-open-to-all/",
      publisher: "Waymo",
      title: "Dallas, open to all",
      published_at: "2026-08-04",
    },
  },
  {
    event_date: "2026-08-13",
    headline: "Waymo becomes the official AV partner of the Las Vegas Raiders",
    body:
      "The first partnership between an NFL team and an autonomous vehicle company, with service to Allegiant Stadium planned for this season. Notable because Las Vegas is still in employee-only operation, making this a public commitment to a near-term public launch.",
    tags: ["partnership"],
    source: {
      url: "https://waymo.com/blog/shorts/allegiant-partnership/",
      publisher: "Waymo",
      title: "Waymo and the Las Vegas Raiders announce partnership",
      published_at: "2026-08-13",
    },
  },
  {
    event_date: "2026-08-14",
    headline: "CPUC approves Sacramento, San Diego, and an 18-county California expansion",
    body:
      "The California Public Utilities Commission authorized paid Waymo service in Sacramento and San Diego and enlarged the approved Bay Area and Los Angeles territories, bringing the authorized footprint to 18 counties. Waymo said the rollout will be gradual.",
    tags: ["operations", "new_city"],
    source: {
      url: "https://www.engadget.com/2237530/waymo-receives-permission-to-offer-rides-in-sacramento-and-san-diego/",
      publisher: "Engadget",
      title: "Waymo receives permission to offer rides in Sacramento and San Diego",
      published_at: "2026-08-14",
    },
  },
];

async function findOrCreateSource(s: SeedMilestone["source"]): Promise<string> {
  const { data: existing } = await client
    .from("sources")
    .select("id")
    .eq("url", s.url)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await client
    .from("sources")
    .insert({
      url: s.url,
      publisher: s.publisher,
      title: s.title,
      published_at: s.published_at + "T00:00:00Z",
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`source insert failed: ${error?.message}`);
  return created.id as string;
}

async function main() {
  const { data: waymo, error: companyError } = await client
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();
  if (companyError || !waymo) {
    console.error("Could not find Waymo company row:", companyError?.message);
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  for (const m of MILESTONES) {
    const { data: existing } = await client
      .from("milestones")
      .select("id")
      .eq("company_id", waymo.id)
      .eq("event_date", m.event_date)
      .eq("headline", m.headline)
      .maybeSingle();

    if (existing) {
      console.log(`skip ${m.event_date}  ${m.headline.slice(0, 60)}`);
      skipped++;
      continue;
    }

    const sourceId = await findOrCreateSource(m.source);
    const { error } = await client.from("milestones").insert({
      company_id: waymo.id,
      event_date: m.event_date,
      headline: m.headline,
      body: m.body,
      tags: m.tags,
      source_id: sourceId,
      is_published: true,
    });
    if (error) {
      console.error(`FAIL ${m.event_date}:`, error.message);
      process.exit(1);
    }
    console.log(`OK   ${m.event_date}  ${m.headline.slice(0, 60)}`);
    inserted++;
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped (already present).`);
}

main();
