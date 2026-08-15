// scripts/run-extraction.ts
// Entry point for the earnings extraction pipeline (module 4.4).
//
//   npx tsx scripts/run-extraction.ts                    # up to 3 pending events
//   npx tsx scripts/run-extraction.ts --limit 20         # backfill-sized run
//   npx tsx scripts/run-extraction.ts --event <uuid>     # one event, any status
//   npx tsx scripts/run-extraction.ts --include-failed   # also retry failures
//   npx tsx scripts/run-extraction.ts --reprocess-below 2  # re-run older versions
//   npx tsx scripts/run-extraction.ts --dry-run --event <uuid>  # chunk stats, no model call
//
// Requires ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { runExtraction, loadPassages } from "@/lib/extraction/run";
import { chunkPassages, selectRelevantPassages, renderChunk } from "@/lib/extraction/text";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // env vars may already be set in the shell
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function dryRun(eventId: string) {
  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: ev } = await client.from("earnings_events").select("*").eq("id", eventId).single();
  if (!ev?.storage_key) throw new Error("event not found or has no storage_key");
  const passages = await loadPassages(client, ev.storage_key);
  const relevant = selectRelevantPassages(passages);
  const chunks = chunkPassages(relevant);
  console.log(`${ev.event_type} ${ev.fiscal_period}: ${passages.length} passages, ${relevant.length} relevant, ${chunks.length} chunk(s)`);
  for (const c of chunks) {
    const text = renderChunk(c);
    console.log(`\n--- chunk ${c.index + 1} (${text.length} chars, ${c.passages.length} passages) ---\n${text.slice(0, 1500)}${text.length > 1500 ? "\n..." : ""}`);
  }
}

async function main() {
  const eventId = arg("--event");
  if (process.argv.includes("--dry-run")) {
    if (!eventId) throw new Error("--dry-run requires --event <uuid>");
    await dryRun(eventId);
    process.exit(0);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }
  const limitRaw = arg("--limit");
  const belowRaw = arg("--reprocess-below");
  const result = await runExtraction({
    limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
    eventId,
    includeFailed: process.argv.includes("--include-failed"),
    reprocessBelowVersion: belowRaw ? parseInt(belowRaw, 10) : undefined,
  });
  const failed = result.processed.filter((r) => r.status === "failed").length;
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
