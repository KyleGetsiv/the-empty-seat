// scripts/update-competitor-snapshots-2026-q2.ts
// Section 0 (dev plan v3) freshness catch-up: the Q2 2026 competitor_snapshots
// rows for Apollo Go and Pony.ai, overdue since both reported on 2026-08-18.
// Adds rows; never edits the Q1 rows, so the landscape keeps its history.
//
// Every figure below was re-verified on 2026-09-30 against the cited primary
// source (company release or the earnings call itself), not taken from
// briefing-2026-08.md. Figures a source did not state are null, not derived:
// Apollo Go's Q2 weekly rides are NOT computed from the quarterly total.
//
// Idempotent: upsert on (program_id, snapshot_date); sources found-or-created
// by URL. Writes straight to the database, so /landscape shows the change only
// after ISR expires or an admin mutation on /admin/snapshots revalidates it.
//
// Run with: npx tsx scripts/update-competitor-snapshots-2026-q2.ts

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

interface Src {
  url: string;
  publisher: string;
  title: string;
  published_at: string;
}

const SNAPSHOTS = [
  {
    program: "apollo-go",
    snapshot_date: "2026-08-18",
    cities_serving_public: 28,
    cities_operating_total: 28,
    vehicle_count: null,
    weekly_rides: null,
    cumulative_rides: 23_000_000,
    autonomous_miles_cumulative: 217_000_000,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "driverless",
    disclosure_quality: "earnings_disclosed",
    notes:
      "Q2 2026 (Baidu earnings, Aug 18, 2026): around 1 million fully driverless operational rides in the quarter, down from 3.2M in Q1, which Robin Li attributed on the call to 'operational adjustments in certain domestic cities due to regulatory considerations' (the April to July permit freeze); affected cities resuming as of August. Cumulative public rides above 23M as of June 2026. Global footprint 28 cities; 350M+ autonomous km (~217M miles), 240M+ of them fully driverless. No weekly figure was disclosed for Q2, so weekly_rides is null rather than derived from the quarterly total. Fleet not disclosed. Ride figures are from the call; cities and km from the release.",
    source: {
      url: "https://ir.baidu.com/news-releases/news-release-details/baidu-announces-second-quarter-2026-results",
      publisher: "Baidu",
      title: "Baidu announces second quarter 2026 results",
      published_at: "2026-08-18",
    },
  },
  {
    program: "pony-ai",
    snapshot_date: "2026-08-18",
    cities_serving_public: null,
    cities_operating_total: null,
    vehicle_count: 1975,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "mixed",
    disclosure_quality: "earnings_disclosed",
    notes:
      "Q2 2026 (Aug 18, 2026): global robotaxi fleet 1,975 vehicles as of June 30, 2026, target 3,500+ by year end. Robotaxi revenue US$12.1M (RMB 81.9M), +691.2% YoY, fare-charging revenue +849.3%. Fully driverless commercial in China's tier-one cities; Singapore via ComfortDelGro's Zig app; Luxembourg with Bolt and Stellantis; 2,000+ robotaxis contracted with Uber for Europe. Management says unit economics turned positive in Guangzhou and Shenzhen. City count left null: the call frames 20 cities as a year-end goal, so no current count was stated. Ride volumes not disclosed.",
    source: {
      url: "https://www.globenewswire.com/news-release/2026/08/18/3346631/0/en/pony-ai-inc-reports-second-quarter-2026-financial-results-total-revenues-up-68-8-yoy-to-us-36-2-mm-with-robotaxi-services-revenue-up-691-2-to-us-12-1-mm.html",
      publisher: "Pony AI (GlobeNewswire)",
      title: "PONY AI Inc. reports second quarter 2026 financial results",
      published_at: "2026-08-18",
    },
  },
] as const;

async function findOrCreateSource(s: Src): Promise<string> {
  const { data: existing } = await client.from("sources").select("id").eq("url", s.url).maybeSingle();
  if (existing) return existing.id as string;
  const { data: created, error } = await client
    .from("sources")
    .insert({ url: s.url, publisher: s.publisher, title: s.title, published_at: s.published_at + "T00:00:00Z" })
    .select("id")
    .single();
  if (error || !created) throw new Error(`source insert failed: ${error?.message}`);
  return created.id as string;
}

async function main() {
  const { data: programs } = await client.from("operator_programs").select("id, slug");
  const progId = new Map((programs ?? []).map((p) => [p.slug, p.id]));

  for (const s of SNAPSHOTS) {
    const pid = progId.get(s.program);
    if (!pid) {
      console.error(`FAIL snapshot ${s.program}: program not found`);
      process.exit(1);
    }
    const sourceId = await findOrCreateSource(s.source);
    const row = {
      program_id: pid,
      snapshot_date: s.snapshot_date,
      cities_serving_public: s.cities_serving_public,
      cities_operating_total: s.cities_operating_total,
      vehicle_count: s.vehicle_count,
      weekly_rides: s.weekly_rides,
      cumulative_rides: s.cumulative_rides,
      autonomous_miles_cumulative: s.autonomous_miles_cumulative,
      funding_total_usd: s.funding_total_usd,
      implied_valuation_usd: s.implied_valuation_usd,
      supervision: s.supervision,
      disclosure_quality: s.disclosure_quality,
      source_id: sourceId,
      notes: s.notes,
    };
    const { error } = await client.from("competitor_snapshots").upsert(row, { onConflict: "program_id,snapshot_date" });
    if (error) {
      console.error(`FAIL snapshot ${s.program}:`, error.message);
      process.exit(1);
    }
    console.log(`OK snapshot ${s.program.padEnd(10)} ${s.snapshot_date} [${s.disclosure_quality}]`);
  }
  console.log("\nDone. Wrote straight to the database: /landscape updates after ISR or an admin save on /admin/snapshots.");
}

main();
