// scripts/fix-remove-stray-ride-row.ts
// One-off fix (module 2.2): removes the stray ride_estimates row that
// duplicated the March 2026 disclosed weekly-rides figure (500,000) as a
// one-week CPUC-style row (period 2026-03-21 to 2026-03-27). The disclosed
// figure lives in site_content (latest_weekly_rides_disclosed) and, after
// module 2.3, in the disclosed_metrics table. As a ride_estimates row it
// corrupted the quarterly chart (bogus 6.5M "Q1 2026" point) and the
// KeyStats cumulative tiles.
//
// Idempotent: deletes only rows matching the exact stray signature.
// Run with: npx tsx scripts/fix-remove-stray-ride-row.ts

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

  const { data: strays, error: findError } = await client
    .from("ride_estimates")
    .select("id, period_start, period_end, rides_per_week")
    .eq("company_id", waymo.id)
    .is("city_id", null)
    .eq("period_start", "2026-03-21")
    .eq("period_end", "2026-03-27")
    .eq("rides_per_week", 500000);

  if (findError) {
    console.error("Query failed:", findError.message);
    process.exit(1);
  }

  if (!strays || strays.length === 0) {
    console.log("No stray row found; nothing to do.");
    process.exit(0);
  }

  for (const row of strays) {
    console.log(
      `Deleting stray row ${row.id} (${row.period_start} to ${row.period_end}, ${row.rides_per_week}/wk)`
    );
    const { error: delError } = await client
      .from("ride_estimates")
      .delete()
      .eq("id", row.id);
    if (delError) {
      console.error("Delete failed:", delError.message);
      process.exit(1);
    }
  }

  console.log(`Done. ${strays.length} row(s) deleted.`);
}

main();
