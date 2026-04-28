// scripts/run-scraper-cpuc.ts
// Entry point for the CPUC quarterly scraper.
// Run with: npx tsx scripts/run-scraper-cpuc.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in environment or .env.local

import { readFileSync } from "fs";
import { resolve } from "path";
import { runCpucScrape } from "@/lib/scrapers/cpuc";

// Load .env.local before calling runCpucScrape (which reads process.env inside the function).
// runCpucScrape does NOT read process.env at import time, only when called, so this ordering is safe.
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // env vars may already be set in the shell (e.g. GitHub Actions)
}

async function main() {
  const result = await runCpucScrape();
  if (result.errors > 0) {
    console.error(`[run-scraper-cpuc] Completed with ${result.errors} error(s)`);
    process.exit(1);
  }
  process.exit(0);
}

main();
