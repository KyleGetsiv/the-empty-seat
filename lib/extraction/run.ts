// lib/extraction/run.ts
//
// Processes pending earnings_events: loads the stored document, keeps the
// passages that can mention Waymo, extracts with the model chunk by chunk,
// verifies quotes, and writes waymo_mentions (review_status 'pending').
// Nothing here is public: the review queue (4.5) gates every quote.
//
// Runs from GitHub Actions hourly (extract-earnings.yml) and from
// scripts/run-extraction.ts locally. Vercel Cron was considered and
// rejected: Hobby crons are daily-only and a 10-K can need a dozen model
// calls, past the function duration limit.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { notifySlack } from "@/lib/notify";
import type { SpeakerTurn } from "@/lib/scrapers/transcripts";
import {
  EXTRACTION_MODEL,
  EXTRACTION_VERSION,
  PRICE_USD_PER_MTOK_IN,
  PRICE_USD_PER_MTOK_OUT,
} from "./schema";
import { extractChunk, makeAnthropicCaller, type ModelCaller, type Usage } from "./extract";
import { STORAGE_BUCKET, writeDropLog, type DroppedQuote } from "./drop-log";
import {
  chunkPassages,
  passagesFromHtml,
  passagesFromTurns,
  selectRelevantPassages,
  type Passage,
} from "./text";

type Client = SupabaseClient<Database>;
type EventRow = Database["public"]["Tables"]["earnings_events"]["Row"];

export interface EventResult {
  event_id: string;
  label: string;
  status: "extracted" | "failed" | "skipped";
  passages_total: number;
  passages_relevant: number;
  chunks: number;
  mentions: number;
  dropped: number;
  deduped: number;
  usage: Usage;
  // False when the run produced a drop log but Storage refused it, so the
  // review queue's "no log yet" state stays honest about why.
  drop_log_written?: boolean;
  error?: string;
}

export interface RunResult {
  processed: EventResult[];
  remaining_pending: number;
}

type MentionInsert = Database["public"]["Tables"]["waymo_mentions"]["Insert"];

export function dedupeMentionRows(rows: MentionInsert[]): MentionInsert[] {
  const seen = new Set<string>();
  const out: MentionInsert[] = [];
  for (const r of rows) {
    const em = r.extracted_metric as { metric?: string; value?: number; period?: string | null; scope?: string } | null;
    const key = em && em.metric && em.value !== undefined
      ? `m|${em.metric}|${em.value}|${em.period ?? ""}|${em.scope ?? ""}`
      : `q|${r.mention_type}|${String(r.quote_text).replace(/\s+/g, " ").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function estimateCostUsd(u: Usage): number {
  return (u.input_tokens * PRICE_USD_PER_MTOK_IN + u.output_tokens * PRICE_USD_PER_MTOK_OUT) / 1_000_000;
}

// Loads the event's document from Storage as passages. Transcripts are
// stored as turns.json (speaker turns); filings and exhibits as HTML.
export async function loadPassages(client: Client, storageKey: string): Promise<Passage[]> {
  const { data, error } = await client.storage.from(STORAGE_BUCKET).download(storageKey);
  if (error || !data) throw new Error(`storage download failed for ${storageKey}: ${error?.message ?? "no data"}`);
  const text = await data.text();
  if (storageKey.endsWith(".json")) {
    const turns = JSON.parse(text) as SpeakerTurn[];
    return passagesFromTurns(turns);
  }
  return passagesFromHtml(text);
}

export async function processEvent(
  client: Client,
  event: EventRow,
  callModel: ModelCaller
): Promise<EventResult> {
  const label = `${event.event_type} ${event.fiscal_period}`;
  const base: EventResult = {
    event_id: event.id,
    label,
    status: "failed",
    passages_total: 0,
    passages_relevant: 0,
    chunks: 0,
    mentions: 0,
    dropped: 0,
    deduped: 0,
    usage: { input_tokens: 0, output_tokens: 0 },
  };

  try {
    if (!event.storage_key) throw new Error("event has no storage_key");
    const passages = await loadPassages(client, event.storage_key);
    base.passages_total = passages.length;
    const relevant = selectRelevantPassages(passages);
    base.passages_relevant = relevant.length;
    const chunks = chunkPassages(relevant);
    base.chunks = chunks.length;

    const context = { fiscal_period: event.fiscal_period, event_type: event.event_type, event_date: event.event_date };
    const rows: Database["public"]["Tables"]["waymo_mentions"]["Insert"][] = [];
    const dropped: DroppedQuote[] = [];
    for (const chunk of chunks) {
      const r = await extractChunk(chunk, context, callModel);
      base.usage.input_tokens += r.usage.input_tokens;
      base.usage.output_tokens += r.usage.output_tokens;
      dropped.push(...r.dropped);
      base.dropped += r.dropped.length;
      for (const m of r.mentions) {
        rows.push({
          earnings_event_id: event.id,
          mention_type: m.mention_type,
          quote_text: m.quote_text,
          speaker: m.speaker,
          extracted_metric: m.extracted_metric,
          confidence: m.confidence,
          page_or_timestamp: m.verified_locator,
          review_status: "pending",
        });
      }
    }

    // Filings repeat their segment tables (results section, then the
    // reconciliation), so the same figure arrives twice. Keep the first
    // occurrence of an identical metric/value/period, or of an identical
    // quote when there is no metric.
    const deduped = dedupeMentionRows(rows);
    base.deduped = rows.length - deduped.length;
    rows.length = 0;
    rows.push(...deduped);

    // Re-runs replace only unreviewed output; approved and rejected mentions
    // are human decisions and stay.
    const { error: delErr } = await client
      .from("waymo_mentions")
      .delete()
      .eq("earnings_event_id", event.id)
      .eq("review_status", "pending");
    if (delErr) throw new Error(`clearing pending mentions: ${delErr.message}`);

    if (rows.length > 0) {
      const { error: insErr } = await client.from("waymo_mentions").insert(rows);
      if (insErr) throw new Error(`inserting mentions: ${insErr.message}`);
    }
    base.mentions = rows.length;

    const { error: updErr } = await client
      .from("earnings_events")
      .update({
        processing_status: "extracted",
        extraction_version: EXTRACTION_VERSION,
        extraction_model: EXTRACTION_MODEL,
        extraction_input_tokens: base.usage.input_tokens,
        extraction_output_tokens: base.usage.output_tokens,
        extraction_chunks: base.chunks,
        mentions_dropped: base.dropped,
        processed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", event.id);
    if (updErr) throw new Error(`updating event: ${updErr.message}`);

    // The drop log is written last and always, including when nothing was
    // dropped: its presence is what lets the review queue distinguish "this
    // extraction lost nothing" from "this event predates the log".
    base.drop_log_written = await writeDropLog(client, {
      event_id: event.id,
      extraction_version: EXTRACTION_VERSION,
      extraction_model: EXTRACTION_MODEL,
      run_at: new Date().toISOString(),
      chunks: base.chunks,
      mentions_kept: base.mentions,
      duplicates_removed: base.deduped,
      dropped,
    });
    base.status = "extracted";
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    await client
      .from("earnings_events")
      .update({ processing_status: "failed", error: base.error, processed_at: new Date().toISOString() })
      .eq("id", event.id);
  }
  return base;
}

export interface RunOptions {
  limit?: number; // events per run
  eventId?: string; // process exactly this event (any status)
  includeFailed?: boolean; // also retry 'failed' events
  reprocessBelowVersion?: number; // re-run 'extracted' events with older extraction_version
  callModel?: ModelCaller;
  client?: Client;
}

export async function runExtraction(opts: RunOptions = {}): Promise<RunResult> {
  const limit = opts.limit ?? 3;
  const client =
    opts.client ??
    (() => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    })();
  const callModel = opts.callModel ?? makeAnthropicCaller();

  const result: RunResult = { processed: [], remaining_pending: 0 };

  try {
    let events: EventRow[] = [];
    if (opts.eventId) {
      const { data } = await client.from("earnings_events").select("*").eq("id", opts.eventId).single();
      if (data) events = [data];
    } else {
      const statuses = ["pending", ...(opts.includeFailed ? ["failed"] : [])];
      const { data } = await client
        .from("earnings_events")
        .select("*")
        .in("processing_status", statuses)
        .order("event_date", { ascending: true })
        .limit(limit);
      events = data ?? [];
      if (events.length < limit && opts.reprocessBelowVersion !== undefined) {
        const { data: stale } = await client
          .from("earnings_events")
          .select("*")
          .eq("processing_status", "extracted")
          .lt("extraction_version", opts.reprocessBelowVersion)
          .order("event_date", { ascending: true })
          .limit(limit - events.length);
        events = events.concat(stale ?? []);
      }
    }

    for (const ev of events) {
      const r = await processEvent(client, ev, callModel);
      result.processed.push(r);
      const cost = estimateCostUsd(r.usage);
      console.log(
        `[extract] ${r.label}: ${r.status}; ${r.passages_relevant}/${r.passages_total} passages, ${r.chunks} chunks, ` +
          `${r.mentions} mentions (${r.dropped} dropped, ${r.deduped} duplicate), ${r.usage.input_tokens} in / ${r.usage.output_tokens} out (~$${cost.toFixed(3)} est.)` +
          (r.error ? ` ERROR ${r.error}` : "")
      );
    }

    const { count } = await client
      .from("earnings_events")
      .select("id", { count: "exact", head: true })
      .eq("processing_status", "pending");
    result.remaining_pending = count ?? 0;

    if (result.processed.length > 0) {
      const lines = result.processed.map((r) => {
        const cost = estimateCostUsd(r.usage);
        return r.status === "extracted"
          ? `${r.label}: ${r.mentions} mentions from ${r.chunks} chunk(s), ${r.usage.input_tokens.toLocaleString()} in / ${r.usage.output_tokens.toLocaleString()} out tokens (~$${cost.toFixed(2)} est.)` +
              (r.dropped > 0 ? `, ${r.dropped} quote(s) dropped (see the drop log in the review queue)` : "")
          : `${r.label}: FAILED (${r.error})`;
      });
      const failed = result.processed.filter((r) => r.status === "failed").length;
      const totalUsage = result.processed.reduce(
        (a, r) => ({ input_tokens: a.input_tokens + r.usage.input_tokens, output_tokens: a.output_tokens + r.usage.output_tokens }),
        { input_tokens: 0, output_tokens: 0 }
      );
      const msg =
        `Extraction (${EXTRACTION_MODEL} v${EXTRACTION_VERSION}): ${result.processed.length} event(s), ` +
        `~$${estimateCostUsd(totalUsage).toFixed(2)} est., ${result.remaining_pending} still pending.\n` +
        lines.join("\n");
      await notifySlack(msg, failed > 0 ? "warn" : "info");
    } else {
      console.log("[extract] nothing to process");
    }
  } catch (fatal) {
    const msg = `Extraction fatal error: ${fatal instanceof Error ? fatal.message : String(fatal)}`;
    console.error(`[extract] ${msg}`);
    await notifySlack(msg, "error");
  }
  return result;
}
