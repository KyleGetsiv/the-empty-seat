/**
 * One-time fix: the latest_weekly_rides_disclosed site_content row was
 * inserted with value and as_of on the same line. This overwrites it with
 * correctly formatted newlines so the parser can extract all three fields.
 */
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
  // env vars may already be set
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CORRECT_BODY = `value: 500000
as_of: 2026-03-26
source_id: a7b36e3c-3551-49b3-98a6-ad3bdb085eeb`;

async function main() {
  const { error } = await supabase
    .from("site_content")
    .update({ markdown_body: CORRECT_BODY })
    .eq("key", "latest_weekly_rides_disclosed");

  if (error) {
    console.error("Update failed:", error.message);
    process.exit(1);
  }

  console.log("Fixed latest_weekly_rides_disclosed markdown_body.");
  console.log("Row now contains:");
  console.log(CORRECT_BODY);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
