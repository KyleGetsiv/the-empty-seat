// lib/scrapers/transcripts.ts
// Module 4.3: earnings call transcript scraper. Source: The Motley Fool
// transcript pages (robots.txt permits /earnings/call-transcripts/ for
// User-agent *; verified 2026-08-15). Discovery is by URL pattern rather
// than crawling: for each expected earnings call we probe the handful of
// dates around the call for
//   https://www.fool.com/earnings/call-transcripts/YYYY/MM/DD/
//     alphabet-googl-qN-YYYY-earnings-call-transcript/
// and stop at the first 200. Fetched pages are stored raw in Storage
// alongside the parsed speaker-turn JSON, and an earnings_events row
// (event_type 'earnings_call') is created in 'pending' for extraction.
//
// Page structure (verified): the article body has an H2 "Full Conference
// Call Transcript"; after it, each speaker turn begins with a paragraph
// starting "Speaker Name: ..." and continues in following paragraphs
// without a prefix. Interstitial promo blocks are DIVs and are dropped.
// Everything before that H2 (date, participants, Fool's own takeaways and
// summary) is Fool editorial and is not part of the transcript.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { notifySlack } from "@/lib/notify";

const STORAGE_BUCKET = "scraped-raw";
const REQUEST_DELAY_MS = 2000;
const FOOL_BASE = "https://www.fool.com/earnings/call-transcripts";

export interface TranscriptTarget {
  companySlug: string; // filer, e.g. 'alphabet'
  subjectSlug: string; // 'waymo'
  ticker: string; // 'googl'
  companyPathName: string; // 'alphabet'
  label: string;
}

export const TRANSCRIPT_TARGETS: TranscriptTarget[] = [
  { companySlug: "alphabet", subjectSlug: "waymo", ticker: "googl", companyPathName: "alphabet", label: "Alphabet" },
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function transcriptUrl(t: TranscriptTarget, q: number, year: number, date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${FOOL_BASE}/${y}/${m}/${d}/${t.companyPathName}-${t.ticker}-q${q}-${year}-earnings-call-transcript/`;
}

// Alphabet reports each quarter in the last week of the month after the
// quarter ends (late Apr, late Jul, late Oct) and early Feb for Q4.
// Returns the candidate publication dates to probe for a given quarter.
export function candidateDates(q: number, year: number): Date[] {
  const windows: Record<number, [number, number, number]> = {
    1: [year, 3, 20], // Apr 20
    2: [year, 6, 18], // Jul 18
    3: [year, 9, 20], // Oct 20
    4: [year + 1, 0, 28], // Jan 28 next year
  };
  const [y, m, d] = windows[q];
  const start = new Date(Date.UTC(y, m, d));
  const out: Date[] = [];
  for (let i = 0; i < 21; i++) out.push(new Date(start.getTime() + i * 86_400_000));
  return out;
}

// Quarters whose call has plausibly happened as of `now` (call is ~4 weeks
// after quarter end; we allow 5 weeks).
export function expectedCallQuarters(now: Date, fromYear = 2024): { q: number; year: number }[] {
  const out: { q: number; year: number }[] = [];
  for (let year = fromYear; year <= now.getUTCFullYear(); year++) {
    for (let q = 1; q <= 4; q++) {
      const endMonth = q * 3; // 3,6,9,12
      const qEnd = new Date(Date.UTC(year, endMonth, 0));
      const callBy = new Date(qEnd.getTime() + 35 * 86_400_000);
      if (callBy <= now) out.push({ q, year });
    }
  }
  return out;
}

export interface SpeakerTurn {
  speaker: string;
  text: string;
  index: number;
}

// Strips tags and decodes the handful of entities that matter.
function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

// Extracts the transcript body paragraphs after the "Full Conference Call
// Transcript" heading. Returns null if the marker is absent (page is not a
// full transcript, or layout changed).
export function extractTranscriptParagraphs(html: string): string[] | null {
  const marker = html.search(/<h2[^>]*>\s*Full Conference Call Transcript\s*<\/h2>/i);
  if (marker < 0) return null;
  const after = html.slice(marker);
  // Article body ends at the next major structural boundary; take everything
  // and rely on paragraph filtering.
  const paras: string[] = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(after))) {
    const t = textOf(m[1]);
    if (!t) continue;
    // Drop Fool boilerplate that sometimes trails the transcript.
    if (/^(This article is a transcript|Motley Fool|The Motley Fool|Should you (buy|invest)|Before you buy)/i.test(t)) break;
    paras.push(t);
  }
  return paras.length > 0 ? paras : null;
}

// Groups paragraphs into speaker turns. A turn starts when a paragraph
// begins with "Name:" where Name is 1-5 capitalized words (allowing
// hyphens, periods, apostrophes) or "Operator".
export function groupSpeakerTurns(paras: string[]): SpeakerTurn[] {
  const turns: SpeakerTurn[] = [];
  const speakerRe = /^((?:[A-Z][\w'.\-]*\s?){1,5}|Operator):\s+(.*)$/;
  let cur: SpeakerTurn | null = null;
  for (const p of paras) {
    const m = p.match(speakerRe);
    if (m && m[1].trim().length <= 40) {
      if (cur) turns.push(cur);
      cur = { speaker: m[1].trim(), text: m[2].trim(), index: turns.length };
    } else if (cur) {
      cur.text += (cur.text ? "\n\n" : "") + p;
    } else {
      // Text before any speaker label: attach to an "Unattributed" turn.
      cur = { speaker: "Unattributed", text: p, index: 0 };
    }
  }
  if (cur) turns.push(cur);
  return turns;
}

// ---------------------------------------------------------------------------
// Scrape run
// ---------------------------------------------------------------------------

export interface TranscriptScrapeResult {
  probed: number;
  found: number;
  created: number;
  skipped_existing: number;
  errors: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function findOrCreateSource(
  client: SupabaseClient,
  url: string,
  title: string,
  publishedAt: string,
  storageKey: string
): Promise<string> {
  const { data: existing } = await client.from("sources").select("id").eq("url", url).maybeSingle();
  if (existing) return existing.id as string;
  const { data: created, error } = await client
    .from("sources")
    .insert({ url, publisher: "The Motley Fool", title, published_at: publishedAt + "T00:00:00Z", scraped_at: new Date().toISOString(), storage_key: storageKey })
    .select("id")
    .single();
  if (error || !created) throw new Error(`source insert failed: ${error?.message}`);
  return created.id as string;
}

export async function runTranscriptScrape(opts: { fromYear?: number } = {}): Promise<TranscriptScrapeResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const userAgent = process.env.SCRAPER_USER_AGENT ?? "TheEmptySeat/1.0";

  const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const result: TranscriptScrapeResult = { probed: 0, found: 0, created: 0, skipped_existing: 0, errors: 0 };

  try {
    const { data: companies } = await client.from("companies").select("id, slug");
    const idBySlug = new Map((companies ?? []).map((c) => [c.slug, c.id]));

    // Existing call events keyed by "filerId|fiscal_period".
    const { data: existing } = await client
      .from("earnings_events")
      .select("company_id, fiscal_period")
      .eq("event_type", "earnings_call");
    const known = new Set((existing ?? []).map((e) => `${e.company_id}|${e.fiscal_period}`));

    const now = new Date();
    for (const t of TRANSCRIPT_TARGETS) {
      const filerId = idBySlug.get(t.companySlug);
      const subjectId = idBySlug.get(t.subjectSlug);
      if (!filerId || !subjectId) {
        console.warn(`[transcripts] company rows missing for ${t.label}; skipping`);
        continue;
      }

      for (const { q, year } of expectedCallQuarters(now, opts.fromYear ?? 2024)) {
        const fiscalPeriod = `Q${q} ${year}`;
        if (known.has(`${filerId}|${fiscalPeriod}`)) {
          result.skipped_existing++;
          continue;
        }

        let hit: { url: string; html: string; date: Date } | null = null;
        for (const date of candidateDates(q, year)) {
          if (date > now) break;
          await sleep(REQUEST_DELAY_MS);
          const u = transcriptUrl(t, q, year, date);
          result.probed++;
          try {
            const res = await fetch(u, { headers: { "User-Agent": userAgent } });
            if (res.status === 200) {
              hit = { url: u, html: await res.text(), date };
              break;
            }
          } catch (err) {
            console.warn(`[transcripts] probe ${u}:`, err);
          }
        }
        if (!hit) {
          console.log(`[transcripts] ${t.label} ${fiscalPeriod}: no transcript found in probe window`);
          continue;
        }
        result.found++;

        try {
          const paras = extractTranscriptParagraphs(hit.html);
          if (!paras) throw new Error(`${fiscalPeriod}: transcript marker not found (layout change?)`);
          const turns = groupSpeakerTurns(paras);
          const dateStr = hit.date.toISOString().slice(0, 10);
          const prefix = `transcripts/${t.companySlug}/${year}-q${q}`;

          await client.storage.from(STORAGE_BUCKET).upload(`${prefix}/page.html`, new TextEncoder().encode(hit.html).buffer as ArrayBuffer, { contentType: "text/html", upsert: true });
          await client.storage.from(STORAGE_BUCKET).upload(`${prefix}/turns.json`, new TextEncoder().encode(JSON.stringify(turns, null, 2)).buffer as ArrayBuffer, { contentType: "application/json", upsert: true });

          const sourceId = await findOrCreateSource(client, hit.url, `${t.label} ${fiscalPeriod} earnings call transcript`, dateStr, `${prefix}/turns.json`);

          const { error } = await client.from("earnings_events").insert({
            company_id: filerId,
            subject_company_id: subjectId,
            fiscal_period: fiscalPeriod,
            event_type: "earnings_call",
            event_date: dateStr,
            source_id: sourceId,
            storage_key: `${prefix}/turns.json`,
            processing_status: "pending",
          });
          if (error) throw new Error(error.message);
          known.add(`${filerId}|${fiscalPeriod}`);
          result.created++;
          console.log(`[transcripts] created ${t.label} ${fiscalPeriod} (${turns.length} turns, ${hit.url})`);
        } catch (err) {
          console.error(`[transcripts] ${fiscalPeriod}:`, err);
          result.errors++;
        }
      }
    }

    const msg = `Transcript scrape: ${result.probed} URLs probed, ${result.found} found, ${result.created} events created, ${result.skipped_existing} already known, ${result.errors} errors.`;
    console.log(`[transcripts] ${msg}`);
    await notifySlack(msg, result.errors > 0 ? "warn" : "info");
  } catch (fatal) {
    const msg = `Transcript scraper fatal error: ${fatal instanceof Error ? fatal.message : String(fatal)}`;
    console.error(`[transcripts] ${msg}`);
    await notifySlack(msg, "error");
    result.errors++;
  }
  return result;
}
