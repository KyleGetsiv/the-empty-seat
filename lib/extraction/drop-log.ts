// lib/extraction/drop-log.ts
//
// The per-event record of what extraction threw away (module 4.5).
//
// 4.4 stored only a count (earnings_events.mentions_dropped), which tells you
// a quote was lost but not which one or why, so a review session cannot tell
// a model hallucination from a parser problem. The log lives in Supabase
// Storage rather than Postgres so the review queue gains this without a
// schema change; it sits next to the raw documents it describes.
//
// One object per event per extraction version, overwritten on re-run:
//   scraped-raw/extraction-logs/{event_id}/v{extraction_version}.json
//
// Absence is meaningful: an event extracted before 4.5 has no log, and the
// review queue says so rather than implying nothing was dropped. Recovering
// the quotes for such an event means reprocessing it.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const STORAGE_BUCKET = "scraped-raw";

export type DropReason = "invalid_schema" | "unverified";

export interface DroppedQuote {
  reason: DropReason;
  // Chunk the model was reading, 1-based, to match the Slack and UI copy.
  chunk: number;
  // The passage id the model cited. Null when the model omitted it or
  // returned something that was not a string.
  locator: string | null;
  // The quote as the model returned it. This is the whole point of the log:
  // an unverified quote is text that does not appear in the document, so it
  // is only ever shown as "the model claimed this", never as a source quote.
  quote_text: string;
  mention_type: string | null;
  // Zod issues for invalid_schema, or a short explanation for unverified.
  detail: string | null;
}

export interface DropLog {
  event_id: string;
  extraction_version: number;
  extraction_model: string;
  run_at: string;
  chunks: number;
  mentions_kept: number;
  duplicates_removed: number;
  dropped: DroppedQuote[];
}

export function dropLogKey(eventId: string, extractionVersion: number): string {
  return `extraction-logs/${eventId}/v${extractionVersion}.json`;
}

// Diagnostics must never sink an extraction run, so both helpers swallow
// their own failures: writeDropLog returns false and the caller logs it.
export async function writeDropLog(
  client: SupabaseClient<Database>,
  log: DropLog
): Promise<boolean> {
  try {
    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(dropLogKey(log.event_id, log.extraction_version), JSON.stringify(log, null, 2), {
        contentType: "application/json",
        upsert: true,
      });
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.warn(`[extract] drop log write failed for ${log.event_id}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function readDropLog(
  client: SupabaseClient<Database>,
  eventId: string,
  extractionVersion: number | null
): Promise<DropLog | null> {
  if (extractionVersion === null) return null;
  try {
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .download(dropLogKey(eventId, extractionVersion));
    if (error || !data) return null;
    return JSON.parse(await data.text()) as DropLog;
  } catch {
    return null;
  }
}
