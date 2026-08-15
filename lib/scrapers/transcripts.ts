// lib/scrapers/transcripts.ts
// Module 4.3: earnings call transcript scraper. Source: The Motley Fool
// transcript pages (robots.txt permits /earnings/call-transcripts/ for
// User-agent *; verified 2026-08-15). Discovery uses Fool's monthly
// sitemaps (https://www.fool.com/sitemap/YYYY/MM, listed in robots.txt):
// for each expected call we read the sitemap(s) for the month or two after
// quarter end and look for
//   /earnings/call-transcripts/YYYY/MM/DD/alphabet-{googl|goog}-qN-YYYY-
//     earnings-call-transcript/
// (Fool files some quarters under GOOG, some under GOOGL). That is one or
// two requests per quarter; the earlier date-probing approach (dozens of
// guessed URLs at 2s spacing) tripped Fool's rate limiter on 2026-08-15 and
// is gone. Fetched pages are stored raw in Storage alongside the parsed
// speaker-turn JSON, and an earnings_events row (event_type
// 'earnings_call') is created in 'pending' for extraction.
//
// Two page layouts are handled. Current (2025+): H2 "Full Conference Call
// Transcript", then paragraphs beginning "Speaker Name: ...", continuation
// paragraphs without a prefix, promo DIVs dropped. Classic (2024 and
// earlier): H2 "Prepared Remarks:" and "Questions and Answers:", speaker
// as its own paragraph "<strong>Name</strong> -- <em>Title</em>", body
// ends at the H2 "Call participants". Everything outside those regions is
// Fool editorial and is not part of the transcript.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { notifySlack } from "@/lib/notify";

const STORAGE_BUCKET = "scraped-raw";
const REQUEST_DELAY_MS = 2000;
const FOOL_SITEMAP_BASE = "https://www.fool.com/sitemap";

export interface TranscriptTarget {
  companySlug: string; // filer, e.g. 'alphabet'
  subjectSlug: string; // 'waymo'
  tickers: string[]; // URL slugs Fool has used, e.g. ['googl', 'goog']
  companyPathName: string; // 'alphabet'
  label: string;
}

export const TRANSCRIPT_TARGETS: TranscriptTarget[] = [
  { companySlug: "alphabet", subjectSlug: "waymo", tickers: ["googl", "goog"], companyPathName: "alphabet", label: "Alphabet" },
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function sitemapUrl(year: number, month: number): string {
  return `${FOOL_SITEMAP_BASE}/${year}/${String(month).padStart(2, "0")}`;
}

// Alphabet reports in the last week of the month after quarter end (late
// Apr, late Jul, late Oct) and early Feb for Q4; Fool posts the transcript
// the same or next day, occasionally reposting weeks later. Reading two
// monthly sitemaps per quarter covers both.
export function sitemapMonths(q: number, year: number): { year: number; month: number }[] {
  const first: Record<number, [number, number]> = { 1: [year, 4], 2: [year, 7], 3: [year, 10], 4: [year + 1, 1] };
  const [y, m] = first[q];
  const second = m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
  return [{ year: y, month: m }, second];
}

// Finds transcript URLs for (target, q, year) in a monthly sitemap. Returns
// them sorted by publication date, earliest first (the original post; later
// entries are reposts under the other ticker).
export function findTranscriptUrls(sitemapXml: string, t: TranscriptTarget, q: number, year: number): string[] {
  const tickers = t.tickers.join("|");
  const re = new RegExp(
    `https?://www\\.fool\\.com/earnings/call-transcripts/(\\d{4})/(\\d{2})/(\\d{2})/${t.companyPathName}-(?:${tickers})-q${q}-${year}-earnings-call-transcript/`,
    "gi"
  );
  const found = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(sitemapXml))) found.set(m[0], `${m[1]}-${m[2]}-${m[3]}`);
  return [...found.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([u]) => u);
}

// Publication date (YYYY-MM-DD) from a transcript URL.
export function dateFromTranscriptUrl(url: string): string {
  const m = url.match(/call-transcripts\/(\d{4})\/(\d{2})\/(\d{2})\//);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

// Fool's rate limiter serves an HTML page instead of an HTTP error.
export function isBlockedPage(html: string): boolean {
  return /You have been blocked/i.test(html) && /Your IP was bad/i.test(html);
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

// Marker prefix for a paragraph that is only a speaker header (classic
// layout). groupSpeakerTurns starts a new turn on it.
export const SPEAKER_TOKEN = "\u0000SPEAKER\u0000";

// Extracts the transcript body paragraphs. Current layout: after the H2
// "Full Conference Call Transcript". Classic layout: after the H2 "Prepared
// Remarks" and before the H2 "Call participants". Speaker-only paragraphs
// ("<strong>Name</strong> -- <em>Title</em>") become SPEAKER_TOKEN + name.
// Returns null if neither marker is present (not a transcript, or layout
// changed).
export function extractTranscriptParagraphs(html: string): string[] | null {
  let start = html.search(/<h2[^>]*>\s*Full Conference Call Transcript\s*<\/h2>/i);
  let region: string;
  let classic = false;
  if (start >= 0) {
    region = html.slice(start);
  } else {
    classic = true;
    start = html.search(/<h2[^>]*>\s*Prepared Remarks:?\s*<\/h2>/i);
    if (start < 0) return null;
    region = html.slice(start);
    const end = region.search(/<h2[^>]*>\s*Call participants:?\s*<\/h2>/i);
    if (end > 0) region = region.slice(0, end);
  }
  const paras: string[] = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(region))) {
    const inner = m[1];
    const sp = classic
      ? inner.match(/^\s*(?:<[^>]+>\s*)*<strong>\s*([^<]{1,60}?)\s*<\/strong>(?:\s*<\/[^>]+>)*\s*(?:--\s*<em>[^<]*<\/em>\s*)?(?:<[^>]+>\s*)*$/i)
      : null;
    if (sp) {
      paras.push(SPEAKER_TOKEN + textOf(sp[1]));
      continue;
    }
    const t = textOf(inner);
    if (!t) continue;
    // Drop Fool boilerplate that sometimes trails the transcript.
    if (/^(This article is a transcript|Motley Fool|The Motley Fool|Should you (buy|invest)|Before you buy|Duration: \d+ minutes|More [A-Z]+ analysis)/i.test(t)) {
      if (/^Duration|^More/.test(t)) continue;
      break;
    }
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
    if (p.startsWith(SPEAKER_TOKEN)) {
      if (cur) turns.push(cur);
      cur = { speaker: p.slice(SPEAKER_TOKEN.length).trim(), text: "", index: turns.length };
      continue;
    }
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
    const sitemapCache = new Map<string, string>();
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

        // Discovery: monthly sitemap(s) after quarter end.
        let transcriptUrl: string | null = null;
        for (const { year: sy, month: sm } of sitemapMonths(q, year)) {
          if (new Date(Date.UTC(sy, sm - 1, 1)) > now) break;
          const key = `${sy}-${sm}`;
          let xml = sitemapCache.get(key);
          if (xml === undefined) {
            await sleep(REQUEST_DELAY_MS);
            result.probed++;
            const res = await fetch(sitemapUrl(sy, sm), { headers: { "User-Agent": userAgent } });
            if (res.status === 429) throw new Error("fool.com returned 429 (rate limited); aborting run, retry later");
            xml = res.ok ? await res.text() : "";
            if (isBlockedPage(xml)) throw new Error("fool.com is rate-limiting this IP (blocked page served); aborting run");
            sitemapCache.set(key, xml);
          }
          const urls = findTranscriptUrls(xml, t, q, year);
          if (urls.length > 0) {
            transcriptUrl = urls[0];
            break;
          }
        }
        if (!transcriptUrl) {
          console.log(`[transcripts] ${t.label} ${fiscalPeriod}: no transcript listed in sitemaps ${sitemapMonths(q, year).map((x) => `${x.year}-${String(x.month).padStart(2, "0")}`).join(", ")}`);
          continue;
        }

        await sleep(REQUEST_DELAY_MS);
        result.probed++;
        const pageRes = await fetch(transcriptUrl, { headers: { "User-Agent": userAgent } });
        if (pageRes.status === 429) throw new Error("fool.com returned 429 (rate limited); aborting run, retry later");
        if (!pageRes.ok) {
          console.warn(`[transcripts] ${fiscalPeriod}: ${transcriptUrl} HTTP ${pageRes.status}`);
          result.errors++;
          continue;
        }
        const html = await pageRes.text();
        if (isBlockedPage(html)) throw new Error("fool.com is rate-limiting this IP (blocked page served); aborting run");
        const hit = { url: transcriptUrl, html, dateStr: dateFromTranscriptUrl(transcriptUrl) };
        result.found++;

        try {
          const paras = extractTranscriptParagraphs(hit.html);
          if (!paras) throw new Error(`${fiscalPeriod}: transcript marker not found (layout change?)`);
          const turns = groupSpeakerTurns(paras);
          const dateStr = hit.dateStr;
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

    const msg = `Transcript scrape: ${result.probed} requests, ${result.found} found, ${result.created} events created, ${result.skipped_existing} already known, ${result.errors} errors.`;
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
