// scripts/update-city-roster-2026-08.ts
// Module 2.4: brings the Waymo city roster to verified August 2026 state.
// Every status and date below was verified against primary or strong
// secondary sources on 2026-08-15 (see the dev plan's State of the world
// briefing); source references live in each city's notes.
//
// Requires migration 0009 (adds 'employee' to the cities status check).
// Idempotent: updates by (company_id, name) and upserts new rows on the
// same unique constraint.
//
// Run with: npx tsx scripts/update-city-roster-2026-08.ts

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

// Updates to existing rows, keyed by city name.
const UPDATES: Record<string, Record<string, unknown>> = {
  Phoenix: {
    notes:
      "First fully driverless commercial launch; largest service area. Freeway rides resumed July 29, 2026 (Sky Harbor included) after the May 2026 suspension. Uber-app pilot ended May 2026; vehicles folded into Waymo's own fleet.",
  },
  "Bay Area": {
    notes:
      "Commercial launch August 2023, open to all June 25, 2024. SFO curbside service since January 29, 2026. CPUC approved expanded Bay Area territory August 14, 2026.",
  },
  Miami: {
    public_access_date: "2026-04-15",
    notes:
      "Waitlist launch January 22, 2026; opened to all riders April 15, 2026 (Waymo blog, 'Florida's new way to ride'). Fleet operations via Moove.",
  },
  Orlando: {
    public_access_date: "2026-04-15",
    notes:
      "Launched February 2026; opened to all riders April 15, 2026 (Waymo blog, 'Florida's new way to ride').",
  },
  Dallas: {
    status: "public",
    public_access_date: "2026-08-04",
    notes:
      "Waitlist began February 24, 2026; waitlist dropped August 4, 2026, first of the Texas cohort to reach open access (~150K on the interest list). Freeway and Love Field airport testing announced. Avis manages depot operations.",
  },
  Nashville: {
    status: "public",
    public_access_date: "2026-04-07",
    notes:
      "Public service opened April 7, 2026 in partnership with Lyft; rides on both Waymo and Lyft apps. Lyft Flexdrive handles fleet operations.",
  },
  Austin: {
    notes:
      "Exclusive on Uber app. Exclusivity ends January 2028 (announced July 24, 2026); Waymo app launches there January 2028, Uber service continues to May 2028.",
  },
  Atlanta: {
    notes:
      "Exclusive on Uber app. Exclusivity ends January 2028 (announced July 24, 2026); Waymo app launches there January 2028, Uber service continues to May 2028.",
  },
};

// New rows. The employee cohort began fully driverless employee-only
// operations July 8, 2026 (Waymo blog 'ro-den-lv-sd-tmpa'); launch_date is
// that operations start, public_access_date stays null until public.
const NEW_CITIES = [
  {
    name: "Las Vegas",
    metro_area: "Las Vegas Valley",
    country: "US",
    launch_date: "2026-07-08",
    public_access_date: null,
    service_area_sq_mi: null,
    status: "employee",
    latitude: 36.1699,
    longitude: -115.1398,
    notes:
      "Fully driverless employee-only operations since July 8, 2026; public interest list open. Official AV partner of the Las Vegas Raiders (August 13, 2026); Allegiant Stadium service planned this NFL season.",
  },
  {
    name: "Denver",
    metro_area: "Denver Metro",
    country: "US",
    launch_date: "2026-07-08",
    public_access_date: null,
    service_area_sq_mi: null,
    status: "employee",
    latitude: 39.7392,
    longitude: -104.9903,
    notes: "Fully driverless employee-only operations since July 8, 2026; public access to follow.",
  },
  {
    name: "San Diego",
    metro_area: "San Diego Metro",
    country: "US",
    launch_date: "2026-07-08",
    public_access_date: null,
    service_area_sq_mi: null,
    status: "employee",
    latitude: 32.7157,
    longitude: -117.1611,
    notes:
      "Fully driverless employee-only operations since July 8, 2026. CPUC approved paid public rides August 14, 2026; rollout to be gradual.",
  },
  {
    name: "Tampa",
    metro_area: "Tampa Bay",
    country: "US",
    launch_date: "2026-07-08",
    public_access_date: null,
    service_area_sq_mi: null,
    status: "employee",
    latitude: 27.9506,
    longitude: -82.4572,
    notes: "Fully driverless employee-only operations since July 8, 2026; public access to follow.",
  },
  {
    name: "Sacramento",
    metro_area: "Sacramento Metro",
    country: "US",
    launch_date: null,
    public_access_date: null,
    service_area_sq_mi: null,
    status: "announced",
    latitude: 38.5816,
    longitude: -121.4944,
    notes: "CPUC approved paid rides August 14, 2026 (part of an 18-county California authorization); launch to be gradual.",
  },
  {
    name: "Detroit",
    metro_area: "Detroit Metro",
    country: "US",
    launch_date: null,
    public_access_date: null,
    service_area_sq_mi: null,
    status: "announced",
    latitude: 42.3314,
    longitude: -83.0458,
    notes: "Announced November 3, 2025 as a winter-weather market; pre-launch as of August 2026.",
  },
  {
    name: "Washington DC",
    metro_area: "Washington DC Metro",
    country: "US",
    launch_date: null,
    public_access_date: null,
    service_area_sq_mi: null,
    status: "announced",
    latitude: 38.9072,
    longitude: -77.0369,
    notes:
      "Announced for 2026 but delayed in regulatory limbo: DDOT safety study halted by federal budget cuts, DC Council AV rideshare bill pending as of July 2026.",
  },
];

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

  let updated = 0;
  for (const [name, fields] of Object.entries(UPDATES)) {
    const { data, error } = await client
      .from("cities")
      .update(fields)
      .eq("company_id", waymo.id)
      .eq("name", name)
      .select("id");
    if (error) {
      console.error(`FAIL update ${name}:`, error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.warn(`WARN update ${name}: no matching row`);
      continue;
    }
    console.log(`OK update  ${name}`);
    updated++;
  }

  let upserted = 0;
  for (const city of NEW_CITIES) {
    const { error } = await client
      .from("cities")
      .upsert({ company_id: waymo.id, ...city }, { onConflict: "company_id,name" });
    if (error) {
      console.error(`FAIL upsert ${city.name}:`, error.message);
      process.exit(1);
    }
    console.log(`OK upsert  ${city.name} (${city.status})`);
    upserted++;
  }

  console.log(`\nDone. ${updated} updated, ${upserted} upserted.`);
}

main();
