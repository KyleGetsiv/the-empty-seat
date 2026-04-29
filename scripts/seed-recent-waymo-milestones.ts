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

type SourceRow = {
  url: string;
  title: string;
  publisher: string;
  published_at: string;
};

type MilestoneRow = {
  event_date: string;
  headline: string;
  body: string;
  tags: string[];
  source_url: string;
  is_published: boolean;
};

const sources: SourceRow[] = [
  {
    url: "https://waymo.com/blog/2024/09/waymo-and-uber-team-up/",
    title: "Waymo and Uber Team Up",
    publisher: "waymo.com",
    published_at: "2024-09-13",
  },
  {
    url: "https://waymo.com/blog/2025/03/waymo-launches-on-uber-in-austin/",
    title: "Waymo Launches on Uber in Austin",
    publisher: "waymo.com",
    published_at: "2025-03-04",
  },
  {
    url: "https://waymo.com/blog/2025/06/waymo-launches-on-uber-in-atlanta/",
    title: "Waymo Expands on Uber to Atlanta",
    publisher: "waymo.com",
    published_at: "2025-06-01",
  },
  {
    url: "https://waymo.com/blog/2025/07/waymo-100-million-rider-only-miles/",
    title: "Waymo Reaches 100 Million Rider-Only Miles",
    publisher: "waymo.com",
    published_at: "2025-07-14",
  },
  {
    url: "https://api.nhtsa.gov/recalls/recallsByVehicle?make=WAYMO&model=JAGUAR%20I-PACE&modelYear=2024",
    title: "NHTSA Recall: Waymo Jaguar I-PACE Software Recall (3,067 vehicles)",
    publisher: "nhtsa.gov",
    published_at: "2025-12-10",
  },
  {
    url: "https://techcrunch.com/2025/12/31/waymo-weekly-rides/",
    title: "Waymo Reaches Approximately 150,000 Paid Rides Per Week",
    publisher: "techcrunch.com",
    published_at: "2025-12-31",
  },
];

const milestones: MilestoneRow[] = [
  {
    event_date: "2024-09-13",
    headline: "Waymo and Uber announce partnership to bring Waymo rides to the Uber app in Austin and Atlanta",
    body: "Waymo and Uber announced a multi-city partnership that would integrate Waymo's autonomous vehicles directly into the Uber app, starting with Austin and Atlanta. The deal marked Waymo's first major distribution partnership with an established rideshare platform and its first planned expansion outside California.",
    tags: ["partnership"],
    source_url: "https://waymo.com/blog/2024/09/waymo-and-uber-team-up/",
    is_published: true,
  },
  {
    event_date: "2025-03-04",
    headline: "Waymo launches on Uber in Austin, its first non-California commercial market",
    body: "Waymo began operating commercially in Austin via the Uber app, coinciding with SXSW. The launch marked Waymo's first market outside California and its first deployment using Uber as the primary consumer interface. The Austin fleet launched with over 100 Jaguar I-PACE vehicles.",
    tags: ["new_city", "partnership"],
    source_url: "https://waymo.com/blog/2025/03/waymo-launches-on-uber-in-austin/",
    is_published: true,
  },
  {
    event_date: "2025-06-01",
    headline: "Waymo expands Uber partnership to Atlanta, entering its second non-California market",
    body: "Waymo extended its Uber partnership to Atlanta, Georgia, making it the company's second commercial market outside California. Like Austin, Atlanta operations run exclusively through the Uber app.",
    tags: ["new_city", "partnership"],
    source_url: "https://waymo.com/blog/2025/06/waymo-launches-on-uber-in-atlanta/",
    is_published: true,
  },
  {
    event_date: "2025-07-14",
    headline: "Waymo surpasses 100 million cumulative rider-only miles",
    body: "Waymo announced that its commercial fleet had surpassed 100 million cumulative miles driven with passengers and no safety driver present. The milestone reflected rapid growth in rider-only operations across San Francisco, Phoenix, Los Angeles, Austin, and Atlanta.",
    tags: ["scale_metrics"],
    source_url: "https://waymo.com/blog/2025/07/waymo-100-million-rider-only-miles/",
    is_published: true,
  },
  {
    event_date: "2025-12-10",
    headline: "NHTSA opens investigation into Waymo software recall covering 3,067 vehicles for pedestrian-detection issue in school zones",
    body: "The National Highway Traffic Safety Administration opened a safety recall investigation into Waymo's software after the company filed a voluntary recall covering 3,067 Jaguar I-PACE vehicles. The issue involved the vehicle's behavior near school zones under specific edge-case conditions. Waymo issued an over-the-air software fix and stated no injuries were reported.",
    tags: ["safety"],
    source_url: "https://api.nhtsa.gov/recalls/recallsByVehicle?make=WAYMO&model=JAGUAR%20I-PACE&modelYear=2024",
    is_published: true,
  },
  {
    event_date: "2025-12-31",
    headline: "Waymo reaches approximately 150,000 paid rides per week across all markets",
    body: "By the end of 2025, Waymo was completing an estimated 150,000 paid rides per week across its commercial markets. The figure, derived from analyst reporting and CPUC filings, represented roughly a tripling of weekly volume from the start of the year. It is an estimate, not a disclosed company figure.",
    tags: ["scale_metrics"],
    source_url: "https://techcrunch.com/2025/12/31/waymo-weekly-rides/",
    is_published: true,
  },
];

async function findOrCreateSource(row: SourceRow): Promise<string> {
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("url", row.url)
    .maybeSingle();

  if (existing) {
    console.log(`  source exists: ${row.url}`);
    return existing.id as string;
  }

  const { data: inserted, error } = await supabase
    .from("sources")
    .insert({
      url: row.url,
      title: row.title,
      publisher: row.publisher,
      published_at: row.published_at,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to insert source ${row.url}: ${error?.message}`);
  }

  console.log(`  created source: ${row.url}`);
  return inserted.id as string;
}

async function main() {
  const { data: waymo, error: waymoErr } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();

  if (waymoErr || !waymo) {
    console.error("Could not find Waymo company row");
    process.exit(1);
  }

  const waymoId = (waymo as { id: string }).id;
  console.log(`Waymo company id: ${waymoId}`);

  // Build source URL -> source ID map
  const sourceMap: Record<string, string> = {};
  console.log("\nInserting sources...");
  for (const s of sources) {
    sourceMap[s.url] = await findOrCreateSource(s);
  }

  console.log("\nInserting milestones...");
  for (const m of milestones) {
    const sourceId = sourceMap[m.source_url];

    // Dedup by headline
    const { data: existing } = await supabase
      .from("milestones")
      .select("id")
      .eq("company_id", waymoId)
      .eq("headline", m.headline)
      .maybeSingle();

    if (existing) {
      console.log(`  skip (exists): ${m.headline.slice(0, 60)}`);
      continue;
    }

    const { error } = await supabase.from("milestones").insert({
      company_id: waymoId,
      event_date: m.event_date,
      headline: m.headline,
      body: m.body,
      tags: m.tags,
      source_id: sourceId,
      is_published: m.is_published,
    });

    if (error) {
      console.error(`  FAILED: ${m.headline.slice(0, 60)}\n  ${error.message}`);
    } else {
      console.log(`  inserted: ${m.headline.slice(0, 60)}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
