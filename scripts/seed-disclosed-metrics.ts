// scripts/seed-disclosed-metrics.ts
// Module 2.3: seeds the disclosed_metrics table with Waymo's verified
// disclosure arc (weekly rides, cumulative trips, fleet size), each row
// backed by a sources entry. Every figure below was re-verified against
// its primary source on 2026-08-15; see notes fields for scope caveats.
//
// Idempotent: sources found-or-created by URL; metric rows upserted on the
// (company_id, metric, as_of) unique constraint. Also deletes the retired
// site_content 'latest_weekly_rides_disclosed' row once its value is
// represented in the table.
//
// Run with: npx tsx scripts/seed-disclosed-metrics.ts

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

interface SeedSource {
  url: string;
  publisher: string;
  title: string;
  published_at: string;
}

interface SeedRow {
  metric: "weekly_rides" | "cumulative_trips" | "fleet_size";
  value: number;
  as_of: string;
  scope: string;
  attribution: "company" | "investor" | "media" | "analyst";
  stated_by: string;
  notes: string | null;
  source: SeedSource;
}

const ROWS: SeedRow[] = [
  // ---- weekly_rides -------------------------------------------------------
  {
    metric: "weekly_rides",
    value: 10000,
    as_of: "2023-08-11",
    scope: "US",
    attribution: "company",
    stated_by: "Waymo blog",
    notes:
      "Stated as rides to members of the public across SF and Phoenix; SF rides were not yet charged at disclosure date, so not fully paid rides.",
    source: {
      url: "https://waymo.com/blog/2023/08/waymos-next-chapter-in-san-francisco/",
      publisher: "Waymo",
      title: "Waymo's next chapter in San Francisco",
      published_at: "2023-08-11",
    },
  },
  {
    metric: "weekly_rides",
    value: 50000,
    as_of: "2024-06-25",
    scope: "US",
    attribution: "company",
    stated_by: "Waymo blog",
    notes:
      "Paid rider-only public trips, primarily SF and Phoenix. Reaffirmed by Sundar Pichai on the Alphabet Q2 2024 call, 2024-07-23.",
    source: {
      url: "https://waymo.com/blog/2024/06/waymo-one-is-now-open-to-everyone-in-san-francisco/",
      publisher: "Waymo",
      title: "Waymo One is now open to everyone in San Francisco",
      published_at: "2024-06-25",
    },
  },
  {
    metric: "weekly_rides",
    value: 100000,
    as_of: "2024-08-20",
    scope: "US",
    attribution: "company",
    stated_by: "Tekedra Mawakana (co-CEO) on X and LinkedIn",
    notes: "Paid rides across LA, SF, Phoenix; excluded Austin (then unpaid testing).",
    source: {
      url: "https://techcrunch.com/2024/08/20/waymo-is-now-giving-100000-robotaxi-rides-week",
      publisher: "TechCrunch",
      title: "Waymo is now giving 100,000 robotaxi rides a week (quoting co-CEO X post)",
      published_at: "2024-08-20",
    },
  },
  {
    metric: "weekly_rides",
    value: 150000,
    as_of: "2024-10-29",
    scope: "US",
    attribution: "company",
    stated_by: "Sundar Pichai, Alphabet Q3 2024 earnings call",
    notes: "Paid rides; also disclosed 1M+ fully autonomous miles driven weekly.",
    source: {
      url: "https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q3-2024/",
      publisher: "Alphabet",
      title: "Sundar Pichai remarks, Alphabet Q3 2024 earnings",
      published_at: "2024-10-29",
    },
  },
  {
    metric: "weekly_rides",
    value: 200000,
    as_of: "2025-02-26",
    scope: "US",
    attribution: "company",
    stated_by: "Sundar Pichai on X",
    notes: "Paid trips across LA, Phoenix, SF; stated as 20x growth in under two years.",
    source: {
      url: "https://techcrunch.com/2025/02/27/waymo-has-doubled-its-weekly-robotaxi-rides-in-less-than-a-year/",
      publisher: "TechCrunch",
      title: "Waymo has doubled its weekly robotaxi rides in less than a year (quoting Pichai X post)",
      published_at: "2025-02-27",
    },
  },
  {
    metric: "weekly_rides",
    value: 250000,
    as_of: "2025-04-24",
    scope: "US",
    attribution: "company",
    stated_by: "Sundar Pichai, Alphabet Q1 2025 earnings call",
    notes:
      "Over a quarter million paid passenger trips per week, up 5x YoY. Last official weekly figure for ~9 months.",
    source: {
      url: "https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q1-2025/",
      publisher: "Alphabet",
      title: "Sundar Pichai remarks, Alphabet Q1 2025 earnings",
      published_at: "2025-04-24",
    },
  },
  {
    metric: "weekly_rides",
    value: 450000,
    as_of: "2025-12-08",
    scope: "US",
    attribution: "investor",
    stated_by: "Tiger Global Management investor letter, reported by CNBC",
    notes:
      "Third-party investor figure; Waymo declined to comment. Sits above Waymo's own 400K+ disclosure from Feb 2026.",
    source: {
      url: "https://techcrunch.com/2025/12/08/investor-letter-reveals-skyrocketing-growth-of-waymos-robotaxi-rides/",
      publisher: "TechCrunch",
      title: "Investor letter reveals skyrocketing growth of Waymo's robotaxi rides",
      published_at: "2025-12-08",
    },
  },
  {
    metric: "weekly_rides",
    value: 400000,
    as_of: "2026-02-02",
    scope: "US",
    attribution: "company",
    stated_by: "Waymo blog ($16B funding announcement)",
    notes:
      "More than 400,000 rides weekly across six US metros. Reaffirmed by Pichai on the Alphabet Q4 2025 call, 2026-02-04.",
    source: {
      url: "https://waymo.com/blog/2026/02/waymo-raises-usd16-billion-investment-round/",
      publisher: "Waymo",
      title: "Waymo raises $16 billion investment round",
      published_at: "2026-02-02",
    },
  },
  {
    metric: "weekly_rides",
    value: 500000,
    as_of: "2026-03-26",
    scope: "US",
    attribution: "company",
    stated_by: "Waymo on X (first stated by co-CEO Dmitri Dolgov, 2026-03-24)",
    notes:
      "500,000 paid rides weekly across 10 US cities; reaffirmed by Pichai on the Alphabet Q1 2026 call, 2026-04-29. Latest official figure as of 2026-08-15.",
    source: {
      url: "https://techcrunch.com/2026/03/27/waymo-skyrocketing-ridership-in-one-chart/",
      publisher: "TechCrunch",
      title: "Waymo's skyrocketing ridership in one chart (quoting Waymo X post)",
      published_at: "2026-03-27",
    },
  },
  // ---- cumulative_trips ---------------------------------------------------
  {
    metric: "cumulative_trips",
    value: 2_000_000,
    as_of: "2024-07-23",
    scope: "US",
    attribution: "company",
    stated_by: "Sundar Pichai, Alphabet Q2 2024 earnings call",
    notes: "More than 2 million trips to date; 20M+ fully autonomous miles.",
    source: {
      url: "https://www.roic.ai/quote/GOOG:US/transcripts/2024-year/2-quarter",
      publisher: "Alphabet",
      title: "Alphabet Q2 2024 earnings call transcript",
      published_at: "2024-07-23",
    },
  },
  {
    metric: "cumulative_trips",
    value: 5_000_000,
    as_of: "2024-12-18",
    scope: "US",
    attribution: "company",
    stated_by: "Waymo 2024 year-in-review blog",
    notes:
      "Over 5 million rides total, over 4 million in 2024 alone. Pichai's Feb 2025 wording ('more than 4 million passenger trips') differs in scope.",
    source: {
      url: "https://waymo.com/blog/2024/12/year-in-review-2024/",
      publisher: "Waymo",
      title: "Waymo 2024 year in review",
      published_at: "2024-12-18",
    },
  },
  {
    metric: "cumulative_trips",
    value: 10_000_000,
    as_of: "2025-05-20",
    scope: "US",
    attribution: "company",
    stated_by: "Tekedra Mawakana (co-CEO), CNBC interview at Google I/O",
    notes: "10 million paid trips, described as doubling in five months.",
    source: {
      url: "https://www.cnbc.com/2025/05/20/waymo-ceo-tekedra-mawakana-10-million.html",
      publisher: "CNBC",
      title: "Waymo reaches 10 million paid trips (Mawakana interview)",
      published_at: "2025-05-20",
    },
  },
  {
    metric: "cumulative_trips",
    value: 20_000_000,
    as_of: "2026-02-02",
    scope: "US",
    attribution: "company",
    stated_by: "Waymo blog ($16B funding announcement)",
    notes:
      "Surpassed 20 million fully autonomous trips; 15 million rides in 2025 alone; 127 million cumulative miles.",
    source: {
      url: "https://waymo.com/blog/2026/02/waymo-raises-usd16-billion-investment-round/",
      publisher: "Waymo",
      title: "Waymo raises $16 billion investment round",
      published_at: "2026-02-02",
    },
  },
  // ---- fleet_size ---------------------------------------------------------
  {
    metric: "fleet_size",
    value: 700,
    as_of: "2024-08-20",
    scope: "US",
    attribution: "company",
    stated_by: "Waymo-provided figure reported with the 100K weekly rides announcement",
    notes: "Around 700 vehicles at the time of the 100K/week disclosure.",
    source: {
      url: "https://www.nbcnews.com/tech/tech-news/waymo-doubled-weekly-paid-robotaxi-trips-100000-may-rcna167396",
      publisher: "NBC News",
      title: "Waymo doubled weekly paid robotaxi trips to 100,000 since May",
      published_at: "2024-08-21",
    },
  },
  {
    metric: "fleet_size",
    value: 1500,
    as_of: "2025-05-05",
    scope: "US",
    attribution: "company",
    stated_by: "Waymo blog (US manufacturing)",
    notes:
      "Over 1,500 vehicles across SF, LA, Phoenix, Austin; 2,000+ more I-PACEs planned through 2026 from the Mesa, AZ factory.",
    source: {
      url: "https://waymo.com/blog/2025/05/scaling-our-fleet-through-us-manufacturing/",
      publisher: "Waymo",
      title: "Scaling our fleet through US manufacturing",
      published_at: "2025-05-05",
    },
  },
  {
    metric: "fleet_size",
    value: 3000,
    as_of: "2026-03-24",
    scope: "US",
    attribution: "company",
    stated_by: "Dmitri Dolgov (co-CEO), Cheeky Pint podcast",
    notes:
      "About 3,000 cars on the road; Waymo separately cited 'over 3,000' to TechCrunch the same week. NHTSA filing 2026-05-06 lists 3,791.",
    source: {
      url: "https://techcrunch.com/2026/03/27/waymo-skyrocketing-ridership-in-one-chart/",
      publisher: "TechCrunch",
      title: "Waymo's skyrocketing ridership in one chart (quoting Waymo X post)",
      published_at: "2026-03-27",
    },
  },
];

async function findOrCreateSource(s: SeedSource): Promise<string> {
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

  let upserted = 0;
  for (const row of ROWS) {
    const sourceId = await findOrCreateSource(row.source);
    const { error } = await client.from("disclosed_metrics").upsert(
      {
        company_id: waymo.id,
        metric: row.metric,
        value: row.value,
        as_of: row.as_of,
        scope: row.scope,
        attribution: row.attribution,
        source_id: sourceId,
        stated_by: row.stated_by,
        notes: row.notes,
      },
      { onConflict: "company_id,metric,as_of" }
    );
    if (error) {
      console.error(`FAIL ${row.metric} ${row.as_of}:`, error.message);
      process.exit(1);
    }
    console.log(`OK   ${row.metric.padEnd(16)} ${row.as_of}  ${row.value.toLocaleString("en-US")}`);
    upserted++;
  }

  // Retire the old site_content representation now that the table holds it.
  const { error: delError } = await client
    .from("site_content")
    .delete()
    .eq("key", "latest_weekly_rides_disclosed");
  if (delError) {
    console.warn("Could not delete site_content row:", delError.message);
  } else {
    console.log("Retired site_content key latest_weekly_rides_disclosed");
  }

  console.log(`\nDone. ${upserted}/${ROWS.length} disclosed_metrics rows upserted.`);
}

main();
