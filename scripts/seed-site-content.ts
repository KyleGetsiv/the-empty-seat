// scripts/seed-site-content.ts
// Upserts the two placeholder site_content rows needed for module 1.1.
// Idempotent: safe to run multiple times. Does not overwrite body if key already exists
// because upsert with ignoreDuplicates=false will overwrite — that is intentional here
// (re-running restores the placeholder if someone deleted the row).
//
// Run with: npx tsx scripts/seed-site-content.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (dotenv is not installed in this project)
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // .env.local may not exist if env vars are already set in the shell
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

const rows = [
  {
    key: "thesis_tagline",
    markdown_body:
      "The Empty Seat is a research project tracking Waymo's commercial rise. [Kyle to replace: one punchy sentence on the core thesis.]",
  },
  {
    key: "thesis_paragraphs",
    markdown_body: `The Empty Seat is a research project. [Kyle to replace: three paragraphs on Waymo's commercial inflection, why this moment matters, and what the site does.]`,
  },
];

async function main() {
  for (const row of rows) {
    const { error } = await client
      .from("site_content")
      .upsert(row, { onConflict: "key" });

    if (error) {
      console.error(`FAIL: upsert for key="${row.key}":`, error.message);
      process.exit(1);
    }
    console.log(`OK: upserted key="${row.key}"`);
  }
  console.log("Done.");
}

main();
