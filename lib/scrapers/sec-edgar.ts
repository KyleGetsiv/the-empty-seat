// lib/scrapers/sec-edgar.ts
// Module 4.2: polls SEC EDGAR for new Alphabet filings and creates
// earnings_events rows in 'pending' status for the extraction pipeline
// (4.4). Uses the data.sec.gov submissions JSON API, never the HTML UI.
//
// Per SEC fair-use policy: declared User-Agent with contact email, at most
// a few requests per second (we use a 2s delay between document fetches),
// and no bulk crawling: only new accession numbers are fetched.
//
// For each new 10-K, 10-Q, or 8-K (8-K only when items include 2.02,
// "Results of Operations", i.e. an earnings release; other 8-Ks are
// governance noise), the primary document and, for 8-Ks, the earnings
// press-release exhibit are downloaded, stored raw in Supabase Storage,
// and an earnings_events row is created with a sources row pointing at
// the SEC filing index. Dedupe key: accession_number (unique in the DB).

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { notifySlack } from "@/lib/notify";

const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions";
const SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data";
const STORAGE_BUCKET = "scraped-raw";
const REQUEST_DELAY_MS = 2000;

// Filers tracked, keyed by the company slug whose mentions we extract.
export interface EdgarFiler {
  cik: string; // 10-digit zero-padded
  cikInt: string; // no leading zeros, used in Archives URLs
  filerSlug: string; // companies.slug of the filer
  subjectSlug: string; // companies.slug of the subject of mentions
  label: string;
}

export const EDGAR_FILERS: EdgarFiler[] = [
  { cik: "0001652044", cikInt: "1652044", filerSlug: "alphabet", subjectSlug: "waymo", label: "Alphabet" },
];

export const TRACKED_FORMS = new Set(["10-K", "10-Q", "8-K"]);

// ---------------------------------------------------------------------------
// Submissions JSON parsing (pure)
// ---------------------------------------------------------------------------

export interface SubmissionsRecent {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  items: string[];
  primaryDocument: string[];
  primaryDocDescription: string[];
  size: number[];
}

export interface FilingRef {
  accession: string; // with dashes, e.g. 0001652044-26-000066
  accessionNoDash: string;
  form: string;
  filingDate: string;
  reportDate: string;
  items: string[];
  primaryDocument: string;
}

// Selects filings worth ingesting from the submissions "recent" block.
export function selectFilings(recent: SubmissionsRecent, opts: { since?: string } = {}): FilingRef[] {
  const out: FilingRef[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    const form = recent.form[i];
    if (!TRACKED_FORMS.has(form)) continue;
    const filingDate = recent.filingDate[i];
    if (opts.since && filingDate < opts.since) continue;
    const items = (recent.items[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    // 8-K: earnings releases only (Item 2.02).
    if (form === "8-K" && !items.includes("2.02")) continue;
    out.push({
      accession: recent.accessionNumber[i],
      accessionNoDash: recent.accessionNumber[i].replace(/-/g, ""),
      form,
      filingDate,
      reportDate: recent.reportDate[i],
      items,
      primaryDocument: recent.primaryDocument[i],
    });
  }
  return out;
}

// Maps a filing to the earnings_events row shape.
export function eventTypeFor(form: string): "10-K" | "10-Q" | "8-K" {
  if (form === "10-K" || form === "10-Q" || form === "8-K") return form;
  throw new Error(`untracked form ${form}`);
}

// Fiscal period label. Alphabet's fiscal year is the calendar year.
// 10-Q/10-K: reportDate is the period end. 8-K earnings releases:
// reportDate is the RELEASE date (e.g. July 22 for the Q2 release), so the
// period is the most recently completed calendar quarter before it.
export function fiscalPeriodFor(form: string, reportDate: string): string {
  const d = new Date(reportDate + "T00:00:00Z");
  let y = d.getUTCFullYear();
  let q = Math.floor(d.getUTCMonth() / 3) + 1;
  if (form === "10-K") return `FY ${y}`;
  if (form === "8-K") {
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
    // Q4 results are reported as the full year in the 10-K, but the
    // release itself is labeled Q4 for consistency with the call.
  }
  return `Q${q} ${y}`;
}

export function filingIndexUrl(cikInt: string, accessionNoDash: string): string {
  return `${SEC_ARCHIVES_BASE}/${cikInt}/${accessionNoDash}/`;
}

export function filingDocUrl(cikInt: string, accessionNoDash: string, doc: string): string {
  return `${SEC_ARCHIVES_BASE}/${cikInt}/${accessionNoDash}/${doc}`;
}

// From an EDGAR filing index.json listing, pick the earnings press-release
// exhibit (EX-99.1). Alphabet names it like "googexhibit991q22026.htm";
// other filers use "ex99-1.htm" or "ex991.htm". Match by "99" plus "1"
// adjacency in the filename, .htm/.html only.
export function pickPressReleaseExhibit(itemNames: string[]): string | null {
  const htm = itemNames.filter((n) => /\.html?$/i.test(n));
  const strong = htm.find((n) => /(ex|exhibit)[-_]?99[-_.]?1\b/i.test(n));
  if (strong) return strong;
  const loose = htm.find((n) => /99[-_.]?1/i.test(n) && /ex/i.test(n));
  return loose ?? null;
}

// ---------------------------------------------------------------------------
// Scrape run
// ---------------------------------------------------------------------------

export interface EdgarScrapeResult {
  checked: number;
  created: number;
  skipped_existing: number;
  errors: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function secFetch(url: string, userAgent: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept-Encoding": "gzip, deflate",
    },
  });
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
    .insert({
      url,
      publisher: "SEC EDGAR",
      title,
      published_at: publishedAt + "T00:00:00Z",
      scraped_at: new Date().toISOString(),
      storage_key: storageKey,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`source insert failed: ${error?.message}`);
  return created.id as string;
}

export async function runEdgarScrape(opts: { since?: string } = {}): Promise<EdgarScrapeResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const userAgent = process.env.SCRAPER_USER_AGENT;
  if (!userAgent || !/\(.+@.+\)/.test(userAgent)) {
    throw new Error("SCRAPER_USER_AGENT must be set with a contact email; SEC requires it");
  }

  const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const result: EdgarScrapeResult = { checked: 0, created: 0, skipped_existing: 0, errors: 0 };

  try {
    const { data: companies } = await client.from("companies").select("id, slug");
    const idBySlug = new Map((companies ?? []).map((c) => [c.slug, c.id]));

    const { data: existingEvents } = await client
      .from("earnings_events")
      .select("accession_number")
      .not("accession_number", "is", null);
    const known = new Set((existingEvents ?? []).map((e) => e.accession_number as string));

    for (const filer of EDGAR_FILERS) {
      const filerId = idBySlug.get(filer.filerSlug);
      const subjectId = idBySlug.get(filer.subjectSlug);
      if (!filerId || !subjectId) {
        console.warn(`[edgar] company rows missing for ${filer.label} (${filer.filerSlug}/${filer.subjectSlug}); skipping`);
        continue;
      }

      const subRes = await secFetch(`${SEC_SUBMISSIONS_BASE}/CIK${filer.cik}.json`, userAgent);
      if (!subRes.ok) throw new Error(`submissions HTTP ${subRes.status} for ${filer.label}`);
      const submissions = (await subRes.json()) as { filings: { recent: SubmissionsRecent } };
      const filings = selectFilings(submissions.filings.recent, opts);
      result.checked += filings.length;

      for (const f of filings) {
        if (known.has(f.accession)) {
          result.skipped_existing++;
          continue;
        }
        try {
          await sleep(REQUEST_DELAY_MS);
          const storagePrefix = `edgar/${filer.cikInt}/${f.accessionNoDash}`;

          // Primary document
          const primaryUrl = filingDocUrl(filer.cikInt, f.accessionNoDash, f.primaryDocument);
          const pRes = await secFetch(primaryUrl, userAgent);
          if (!pRes.ok) throw new Error(`primary doc HTTP ${pRes.status}`);
          const primaryHtml = new Uint8Array(await pRes.arrayBuffer());
          await client.storage
            .from(STORAGE_BUCKET)
            .upload(`${storagePrefix}/${f.primaryDocument}`, primaryHtml.slice().buffer as ArrayBuffer, {
              contentType: "text/html",
              upsert: true,
            });
          let mainDocKey = `${storagePrefix}/${f.primaryDocument}`;

          // 8-K: the press-release exhibit is the document that matters.
          if (f.form === "8-K") {
            await sleep(REQUEST_DELAY_MS);
            const idxRes = await secFetch(`${filingIndexUrl(filer.cikInt, f.accessionNoDash)}index.json`, userAgent);
            if (idxRes.ok) {
              const idx = (await idxRes.json()) as { directory: { item: { name: string }[] } };
              const exhibit = pickPressReleaseExhibit(idx.directory.item.map((i) => i.name));
              if (exhibit) {
                await sleep(REQUEST_DELAY_MS);
                const eRes = await secFetch(filingDocUrl(filer.cikInt, f.accessionNoDash, exhibit), userAgent);
                if (eRes.ok) {
                  const exHtml = new Uint8Array(await eRes.arrayBuffer());
                  await client.storage
                    .from(STORAGE_BUCKET)
                    .upload(`${storagePrefix}/${exhibit}`, exHtml.slice().buffer as ArrayBuffer, {
                      contentType: "text/html",
                      upsert: true,
                    });
                  mainDocKey = `${storagePrefix}/${exhibit}`;
                }
              }
            }
          }

          const eventType = eventTypeFor(f.form);
          const fiscalPeriod = fiscalPeriodFor(f.form, f.reportDate);
          const sourceId = await findOrCreateSource(
            client,
            filingIndexUrl(filer.cikInt, f.accessionNoDash),
            `${filer.label} ${f.form}, ${fiscalPeriod} (filed ${f.filingDate})`,
            f.filingDate,
            mainDocKey
          );

          const { error } = await client.from("earnings_events").insert({
            company_id: filerId,
            subject_company_id: subjectId,
            fiscal_period: fiscalPeriod,
            event_type: eventType,
            event_date: f.filingDate,
            source_id: sourceId,
            storage_key: mainDocKey,
            accession_number: f.accession,
            processing_status: "pending",
          });
          if (error) throw new Error(error.message);
          known.add(f.accession);
          result.created++;
          console.log(`[edgar] created ${filer.label} ${f.form} ${fiscalPeriod} (${f.accession})`);
        } catch (err) {
          console.error(`[edgar] ${f.accession}:`, err);
          result.errors++;
        }
      }
    }

    const msg =
      `EDGAR scrape: ${result.checked} tracked filings checked, ${result.created} new events created, ` +
      `${result.skipped_existing} already known, ${result.errors} errors.`;
    console.log(`[edgar] ${msg}`);
    await notifySlack(msg, result.errors > 0 ? "warn" : "info");
  } catch (fatal) {
    const msg = `EDGAR scraper fatal error: ${fatal instanceof Error ? fatal.message : String(fatal)}`;
    console.error(`[edgar] ${msg}`);
    await notifySlack(msg, "error");
    result.errors++;
  }
  return result;
}
