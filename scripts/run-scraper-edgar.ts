// scripts/run-scraper-edgar.ts
// Entry point for the SEC EDGAR scraper (module 4.2).
// Run with: npx tsx scripts/run-scraper-edgar.ts [--since YYYY-MM-DD]
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SCRAPER_USER_AGENT (with contact email) in environment or .env.local.
// --since limits to filings on or after that date (used by the 4.7
// backfill; the daily action runs without it and dedupes by accession).

import { readFileSync } from "fs";
import { resolve } from "path";
import { runEdgarScrape } from "@/lib/scrapers/sec-edgar";

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
  const sinceIdx = process.argv.indexOf("--since");
  const since = sinceIdx >= 0 ? process.argv[sinceIdx + 1] : undefined;
  const result = await runEdgarScrape({ since });
  if (result.errors > 0) {
    console.error(`[run-scraper-edgar] Completed with ${result.errors} error(s)`);
    process.exit(1);
  }
  process.exit(0);
}
main();
