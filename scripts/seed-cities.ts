// scripts/seed-cities.ts
// One-off bootstrap: seeds 11 Waymo cities into the cities table.
// Idempotent via upsert on (company_id, name) unique constraint (0004_cities_company_name_unique.sql).
// Run with: npx tsx scripts/seed-cities.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

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
  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();

  if (companyError || !company) {
    console.error("Could not find Waymo company row:", companyError?.message);
    process.exit(1);
  }

  const waymoId = company.id;
  console.log(`Waymo company_id: ${waymoId}`);

  const cities = [
    {
      company_id: waymoId,
      name: "Phoenix",
      metro_area: "Phoenix Metro",
      country: "US",
      launch_date: "2020-10-08",
      public_access_date: "2020-10-08",
      service_area_sq_mi: 315,
      status: "public",
      latitude: 33.4484,
      longitude: -112.0740,
      notes: "First fully driverless commercial launch. Earliest Waymo market and largest service area.",
    },
    {
      company_id: waymoId,
      name: "San Francisco",
      metro_area: "San Francisco Bay Area",
      country: "US",
      launch_date: "2023-08-01",
      public_access_date: "2024-06-25",
      service_area_sq_mi: 80,
      status: "public",
      latitude: 37.7749,
      longitude: -122.4194,
      notes: "Commercial launch August 2023, opened to all users without waitlist June 25, 2024.",
    },
    {
      company_id: waymoId,
      name: "Los Angeles",
      metro_area: "Los Angeles Metro",
      country: "US",
      launch_date: "2024-11-12",
      public_access_date: "2024-11-12",
      service_area_sq_mi: 120,
      status: "public",
      latitude: 34.0522,
      longitude: -118.2437,
      notes: "Public launch November 12, 2024. Direct access via Waymo app.",
    },
    {
      company_id: waymoId,
      name: "Austin",
      metro_area: "Austin Metro",
      country: "US",
      launch_date: "2025-03-04",
      public_access_date: "2025-03-04",
      service_area_sq_mi: 37,
      status: "public",
      latitude: 30.2672,
      longitude: -97.7431,
      notes: "Exclusive on Uber app; Uber manages dispatch and fleet operations.",
    },
    {
      company_id: waymoId,
      name: "Atlanta",
      metro_area: "Atlanta Metro",
      country: "US",
      launch_date: "2025-06-24",
      public_access_date: "2025-06-24",
      service_area_sq_mi: 65,
      status: "public",
      latitude: 33.7490,
      longitude: -84.3880,
      notes: "Exclusive on Uber app; service launched June 24, 2025.",
    },
    {
      company_id: waymoId,
      name: "Miami",
      metro_area: "Miami Metro",
      country: "US",
      launch_date: "2026-01-22",
      public_access_date: "2026-04-23",
      service_area_sq_mi: 60,
      status: "public",
      latitude: 25.7617,
      longitude: -80.1918,
      notes: "Waitlist launch January 22, 2026; opened to general public April 23, 2026. Fleet operations via Moove.",
    },
    {
      company_id: waymoId,
      name: "Orlando",
      metro_area: "Orlando Metro",
      country: "US",
      launch_date: "2026-02-24",
      public_access_date: "2026-04-23",
      service_area_sq_mi: null,
      status: "public",
      latitude: 28.5383,
      longitude: -81.3792,
      notes: "Waitlist launch February 24, 2026; opened to public April 23, 2026.",
    },
    {
      company_id: waymoId,
      name: "Dallas",
      metro_area: "Dallas-Fort Worth",
      country: "US",
      launch_date: "2026-02-24",
      public_access_date: null,
      service_area_sq_mi: null,
      status: "waitlist",
      latitude: 32.7767,
      longitude: -96.7970,
      notes: "Waitlist phase began February 24, 2026. Avis manages depot operations.",
    },
    {
      company_id: waymoId,
      name: "Houston",
      metro_area: "Houston Metro",
      country: "US",
      launch_date: "2026-02-24",
      public_access_date: null,
      service_area_sq_mi: null,
      status: "waitlist",
      latitude: 29.7604,
      longitude: -95.3698,
      notes: "Waitlist phase began February 24, 2026.",
    },
    {
      company_id: waymoId,
      name: "San Antonio",
      metro_area: "San Antonio Metro",
      country: "US",
      launch_date: "2026-02-24",
      public_access_date: null,
      service_area_sq_mi: null,
      status: "waitlist",
      latitude: 29.4241,
      longitude: -98.4936,
      notes: "Waitlist phase began February 24, 2026.",
    },
    {
      company_id: waymoId,
      name: "Nashville",
      metro_area: "Nashville Metro",
      country: "US",
      launch_date: "2026-04-07",
      public_access_date: null,
      service_area_sq_mi: 60,
      status: "waitlist",
      latitude: 36.1627,
      longitude: -86.7816,
      notes: "Waitlist phase began April 7, 2026. Fleet operations via Lyft Flexdrive; integration with Lyft app planned.",
    },
  ];

  let successCount = 0;
  for (const city of cities) {
    const { error } = await client
      .from("cities")
      .upsert(city, { onConflict: "company_id,name" });

    if (error) {
      console.error(`FAIL: "${city.name}":`, error.message);
      process.exit(1);
    }
    console.log(`OK: "${city.name}"`);
    successCount++;
  }

  console.log(`\nDone. ${successCount}/${cities.length} cities upserted.`);
}

main();
