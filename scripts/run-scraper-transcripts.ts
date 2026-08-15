// scripts/run-scraper-transcripts.ts
// Entry point for the earnings call transcript scraper (module 4.3).
// Run with: npx tsx scripts/run-scraper-transcripts.ts [--from-year 2024]
// Probes Motley Fool transcript URLs for every expected quarter since
// --from-year (default 2024) that is not already in earnings_events, so a
// first run doubles as the transcript backfill.

import { readFileSync } from "fs";
import { resolve } from "path";
import { runTranscriptScrape } from "@/lib/scrapers/transcripts";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // env vars may already be set in the shell
}

async function main() {
  const i = process.argv.indexOf("--from-year");
  const fromYear = i >= 0 ? parseInt(process.argv[i + 1], 10) : undefined;
  const result = await runTranscriptScrape({ fromYear });
  if (result.errors > 0) {
    console.error(`[run-scraper-transcripts] Completed with ${result.errors} error(s)`);
    process.exit(1);
  }
  process.exit(0);
}
main();
