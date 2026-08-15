// lib/scrapers/cpuc.ts
// v2 (module 2.2): scrapes CPUC quarterly Waymo deployment data DIRECTLY from
// cpuc.ca.gov. The v1 source (Robotaxi Tracker's JSON mirror) was removed in
// mid-2026; its data paths now serve the site homepage, which this scraper's
// predecessor treated as a silent skip. This version fetches CPUC's published
// quarterly zip archives, parses the Driverless monthly rollup CSV, and posts
// a Slack WARN when an expected quarter is overdue rather than silently
// reporting success.
//
// Primary source: California Public Utilities Commission AV Deployment
// Program quarterly data reports (zip archives of CSVs, one per quarter).
// URL pattern, stable since 2025 Q2: waymo-deployment-{year}q{q}.zip
//
// Writes quarterly rows to ride_estimates with city_id = NULL (CA company-wide
// scope), rides_per_week = total_trips / 13, confidence 'high'. Restated
// quarters update in place. Small CSVs (monthly rollups, incidents, stoppage
// events) are archived to Supabase Storage so later phases (safety dashboard)
// can re-process without re-scraping; multi-MB trip-level files are skipped.
//
// Module 3.4 adds the Pilot Program zip (av-pilot-{year}q{q}.zip): Zoox and
// Nuro driverless month-level data ingested per operator program with
// tier 'pilot'. Zoox files the template as an xlsx (see cpuc-xlsx.ts).

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { unzipSync, strToU8 } from "fflate";
import { notifySlack } from "@/lib/notify";
import { readXlsxSheet, rowsToCsv } from "@/lib/scrapers/cpuc-xlsx";
import {
  type Quarter,
  CPUC_PAGE_URL,
  OVERDUE_GRACE_DAYS,
  quarterLabel,
  quarterDateRange,
  isOverdue,
  expectedQuarters,
} from "@/lib/cpuc-calendar";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CPUC_MEDIA_BASE =
  "https://www.cpuc.ca.gov/-/media/cpuc-website/divisions/consumer-protection-and-enforcement-division/documents/tlab/av-programs";

const WAYMO_SLUG = "waymo";
const WEEKS_PER_QUARTER = 13;
const REQUEST_DELAY_MS = 2000;
const STORAGE_BUCKET = "scraped-raw";

// Files at or above this uncompressed size are trip-level bulk and are not
// archived to Storage.
const ARCHIVE_MAX_BYTES = 2_000_000;

export function deploymentZipUrl(qt: Quarter): string {
  return `${CPUC_MEDIA_BASE}/waymo-deployment-${qt.year}q${qt.q}.zip`;
}

// Pilot Program archive: one zip per quarter containing every pilot
// carrier's filing in its own folder. Pattern stable since 2025 Q2.
export function pilotZipUrl(qt: Quarter): string {
  return `${CPUC_MEDIA_BASE}/av-pilot-${qt.year}q${qt.q}.zip`;
}

// Pilot carriers ingested (module 3.4). Each maps a folder in the pilot
// zip to an operator program slug. Carriers file the CPUC template either
// as CSVs (Waymo style) or as an xlsx workbook with a "Month-Level" sheet
// (Zoox style); extractPilotMonthCsv handles both. Aurora, Tensor, and
// WeRide file trucking or testing data in non-template formats and are
// out of scope for a passenger-ride series.
export interface PilotCarrier {
  folder: string; // folder name inside the pilot zip, matched case-insensitively
  programSlug: string;
  companySlug: string;
  label: string;
}

export const PILOT_CARRIERS: PilotCarrier[] = [
  { folder: "Zoox", programSlug: "zoox", companySlug: "zoox", label: "Zoox" },
  { folder: "Nuro", programSlug: "uber-nuro-lucid", companySlug: "nuro", label: "Nuro" },
];

// ---------------------------------------------------------------------------
// CSV parsing (quoted fields with embedded thousands-separator commas)
// ---------------------------------------------------------------------------

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toNumber(s: string): number {
  const n = parseFloat(s.replace(/,/g, "").trim());
  return Number.isNaN(n) ? 0 : n;
}

export interface MonthRow {
  year: number;
  month: number;
  totalTrips: number;
  totalVmtZev: number;
}

// Parses an AV_Month CSV (header row + one row per month).
// Column positions are resolved by header name so column reordering in a
// future template revision does not silently misparse.
export function parseMonthCsv(text: string): MonthRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const iYear = col("Year");
  const iMonth = col("Month");
  const iTrips = col("TotalTrips");
  const iVmtZev = col("TotalVMTZEV");
  if (iYear < 0 || iMonth < 0 || iTrips < 0 || iVmtZev < 0) {
    throw new Error(
      `AV_Month CSV missing expected columns; header was: ${lines[0]}`
    );
  }

  const rows: MonthRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    if (cells.length <= Math.max(iYear, iMonth, iTrips, iVmtZev)) continue;
    rows.push({
      year: toNumber(cells[iYear]),
      month: toNumber(cells[iMonth]),
      totalTrips: toNumber(cells[iTrips]),
      totalVmtZev: toNumber(cells[iVmtZev]),
    });
  }
  return rows;
}

export interface QuarterTotals {
  totalTrips: number;
  totalVmtZev: number;
  monthsFound: number;
}

// Sums the three months of the given quarter. Returns monthsFound so callers
// can reject partial filings.
export function aggregateQuarter(rows: MonthRow[], qt: Quarter): QuarterTotals {
  const months = [qt.q * 3 - 2, qt.q * 3 - 1, qt.q * 3];
  const inQuarter = rows.filter(
    (r) => r.year === qt.year && months.includes(r.month)
  );
  const distinctMonths = new Set(inQuarter.map((r) => r.month));
  return {
    totalTrips: inQuarter.reduce((s, r) => s + r.totalTrips, 0),
    totalVmtZev: inQuarter.reduce((s, r) => s + r.totalVmtZev, 0),
    monthsFound: distinctMonths.size,
  };
}

// ---------------------------------------------------------------------------
// Zip handling
// ---------------------------------------------------------------------------

export interface ExtractedZip {
  monthCsv: string;
  archivable: { name: string; data: Uint8Array }[];
}

// Extracts the Driverless AV_Month CSV plus all small CSVs worth archiving.
// The filename prefix inside the zip encodes Waymo's TCP ID and the filing
// month, so files are matched by suffix pattern, never by exact name.
export function extractFromZip(zipBytes: Uint8Array): ExtractedZip {
  const files = unzipSync(zipBytes, {
    filter: (file) =>
      /\.csv$/i.test(file.name) && file.originalSize < ARCHIVE_MAX_BYTES,
  });

  const monthKey = Object.keys(files).find((name) =>
    /driverless\/.*av_month_part\d+.*\.csv$/i.test(name)
  );
  if (!monthKey) {
    throw new Error(
      `No Driverless AV_Month CSV found in zip; files: ${Object.keys(files)
        .slice(0, 10)
        .join(", ")}`
    );
  }

  const archivable = Object.entries(files).map(([name, data]) => ({
    // Keep the Drivered/Driverless folder plus basename so same-named files
    // from the two folders cannot collide; the Storage prefix carries the
    // quarter.
    name: name.split("/").slice(-2).join("/"),
    data,
  }));

  return {
    monthCsv: new TextDecoder().decode(files[monthKey]),
    archivable,
  };
}

// Finds a pilot carrier's driverless month-level data inside the pilot zip.
// Prefers the Driverless tier (folder or filename containing "driverless");
// falls back to any month-level file for the carrier. Returns CSV text in
// the AV_Month schema plus the small archivable files for that carrier.
export function extractPilotMonthCsv(
  zipBytes: Uint8Array,
  carrier: PilotCarrier
): ExtractedZip | null {
  const folderRe = new RegExp(`(^|/)${carrier.folder}/`, "i");
  const files = unzipSync(zipBytes, {
    filter: (f) => folderRe.test(f.name) && f.originalSize > 0,
  });
  const names = Object.keys(files);
  if (names.length === 0) return null;

  const isDriverless = (n: string) => /driverless/i.test(n);
  const monthCsvs = names.filter((n) => /\.csv$/i.test(n) && /av_month_part\d+/i.test(n));
  const monthXlsx = names.filter(
    (n) => /\.xlsx$/i.test(n) && !/tract|incident|charg|stoppage/i.test(n)
  );

  let monthCsv: string | null = null;

  // 1. CSV template (Waymo-style pilot filing)
  const csvPick = monthCsvs.find(isDriverless) ?? monthCsvs[0];
  if (csvPick) monthCsv = new TextDecoder().decode(files[csvPick]);

  // 2. xlsx template (Zoox-style): read the Month-Level sheet
  if (!monthCsv) {
    const xlsxPick = monthXlsx.find(isDriverless) ?? monthXlsx.find(() => true);
    if (xlsxPick) {
      const rows = readXlsxSheet(files[xlsxPick], "Month-Level");
      monthCsv = rowsToCsv(rows);
    }
  }
  if (!monthCsv) return null;

  const archivable = names
    .filter((n) => files[n].length < ARCHIVE_MAX_BYTES && !/\.pdf$/i.test(n))
    .map((n) => ({ name: n.split("/").slice(-2).join("/"), data: files[n] }));
  // Always archive the extracted month CSV itself under a stable name.
  archivable.push({
    name: `${carrier.folder}/month-level-extracted.csv`,
    data: strToU8(monthCsv),
  });

  return { monthCsv, archivable };
}

// ---------------------------------------------------------------------------
// Scrape run
// ---------------------------------------------------------------------------

export interface CpucScrapeResult {
  inserted: number;
  updated: number;
  unchanged: number;
  notYetPosted: string[];
  overdue: string[];
  errors: number;
  dbQuarters: string[];
  pilot: { inserted: number; updated: number; unchanged: number; missing: string[] };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureBucket(client: SupabaseClient): Promise<void> {
  const { error } = await client.storage.createBucket(STORAGE_BUCKET, {
    public: false,
  });
  // "already exists" is fine; anything else is surfaced by upload failures.
  if (error && !/already exists/i.test(error.message)) {
    console.warn(`[cpuc] createBucket: ${error.message}`);
  }
}

async function archiveFiles(
  client: SupabaseClient,
  qt: Quarter,
  files: { name: string; data: Uint8Array }[]
): Promise<string> {
  const prefix = `cpuc/waymo-deployment-${qt.year}q${qt.q}`;
  for (const f of files) {
    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(`${prefix}/${f.name}`, f.data.slice().buffer as ArrayBuffer, {
        contentType: "text/csv",
        upsert: true,
      });
    if (error) console.warn(`[cpuc] archive ${f.name}: ${error.message}`);
  }
  return prefix;
}

async function findOrCreateQuarterSource(
  client: SupabaseClient,
  qt: Quarter,
  storageKey: string,
  opts: { url?: string; title?: string } = {}
): Promise<string> {
  const url = opts.url ?? deploymentZipUrl(qt);
  const { data: existing } = await client
    .from("sources")
    .select("id")
    .eq("url", url)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await client
    .from("sources")
    .insert({
      url,
      publisher: "California Public Utilities Commission",
      title: opts.title ?? `Waymo Quarterly AV Deployment Report, ${quarterLabel(qt)}`,
      scraped_at: new Date().toISOString(),
      storage_key: storageKey,
    })
    .select("id")
    .single();
  if (error || !created)
    throw new Error(`Failed to create source row: ${error?.message}`);
  return created.id as string;
}

export async function runCpucScrape(): Promise<CpucScrapeResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result: CpucScrapeResult = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    notYetPosted: [],
    overdue: [],
    errors: 0,
    dbQuarters: [],
    pilot: { inserted: 0, updated: 0, unchanged: 0, missing: [] },
  };

  try {
    const { data: company, error: companyError } = await client
      .from("companies")
      .select("id")
      .eq("slug", WAYMO_SLUG)
      .single();
    if (companyError || !company) {
      throw new Error(
        `Could not find company '${WAYMO_SLUG}': ${companyError?.message}`
      );
    }
    const waymoId = (company as { id: string }).id;

    await ensureBucket(client);

    const now = new Date();
    const expected = expectedQuarters(now);
    // First calendar week of each month: re-verify every pattern-era quarter
    // for restatements. Other runs: fetch only missing quarters plus the two
    // most recent, keeping weekly no-op runs light.
    const deepVerify = now.getUTCDate() <= 7;

    // What is already in the database?
    const { data: existingRows } = await client
      .from("ride_estimates")
      .select("id, period_start, rides_per_week, vehicle_miles_traveled")
      .eq("company_id", waymoId)
      .is("city_id", null);
    const byPeriodStart = new Map(
      (existingRows ?? []).map((r) => [r.period_start as string, r])
    );

    const userAgent = process.env.SCRAPER_USER_AGENT ?? "TheEmptySeat/1.0";
    let fetchedAny = false;

    for (const qt of expected) {
      const label = quarterLabel(qt);
      const { period_start, period_end } = quarterDateRange(qt);
      const existing = byPeriodStart.get(period_start);
      const isRecent =
        expected.indexOf(qt) >= expected.length - 2; /* last two expected */

      if (existing && !deepVerify && !isRecent) continue;

      try {
        if (fetchedAny) await sleep(REQUEST_DELAY_MS);
        fetchedAny = true;

        const res = await fetch(deploymentZipUrl(qt), {
          headers: { "User-Agent": userAgent },
        });

        if (res.status === 404) {
          if (existing) {
            // Published before, missing now: CPUC reshuffled the URL. Surface.
            console.warn(`[cpuc] ${label} zip 404 but quarter exists in DB`);
            result.errors++;
          } else if (isOverdue(qt, now)) {
            result.overdue.push(label);
          } else {
            result.notYetPosted.push(label);
          }
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${label}`);

        const zipBytes = new Uint8Array(await res.arrayBuffer());
        const { monthCsv, archivable } = extractFromZip(zipBytes);
        const totals = aggregateQuarter(parseMonthCsv(monthCsv), qt);

        if (totals.monthsFound < 3) {
          throw new Error(
            `${label}: only ${totals.monthsFound} month(s) in AV_Month CSV; skipping partial filing`
          );
        }

        const ridesPerWeek = Math.floor(totals.totalTrips / WEEKS_PER_QUARTER);
        const storageKey = await archiveFiles(client, qt, archivable);
        const sourceId = await findOrCreateQuarterSource(client, qt, storageKey);

        const methodologyNote =
          `Sourced directly from the California Public Utilities Commission quarterly ` +
          `AV Deployment Program data report (${deploymentZipUrl(qt)}), Driverless ` +
          `monthly rollup summed across the quarter. California operations only. ` +
          `Rides per week normalized using ${WEEKS_PER_QUARTER} weeks per quarter.`;

        if (existing) {
          const matches =
            existing.rides_per_week === ridesPerWeek &&
            Math.round(Number(existing.vehicle_miles_traveled ?? 0)) ===
              Math.round(totals.totalVmtZev);
          if (matches) {
            result.unchanged++;
          } else {
            const { error: updateError } = await client
              .from("ride_estimates")
              .update({
                rides_per_week: ridesPerWeek,
                vehicle_miles_traveled: totals.totalVmtZev,
                source_id: sourceId,
                methodology_note: methodologyNote,
              })
              .eq("id", existing.id as string);
            if (updateError) throw new Error(updateError.message);
            result.updated++;
            console.log(`[cpuc] ${label} restated; updated in place`);
          }
        } else {
          const { error: insertError } = await client
            .from("ride_estimates")
            .insert({
              company_id: waymoId,
              city_id: null,
              tier: "deployment",
              period_start,
              period_end,
              rides_per_week: ridesPerWeek,
              vehicle_miles_traveled: totals.totalVmtZev,
              source_id: sourceId,
              confidence: "high",
              methodology_note: methodologyNote,
            });
          if (insertError) throw new Error(insertError.message);
          result.inserted++;
          console.log(
            `[cpuc] ${label} inserted: ${totals.totalTrips} trips, ${totals.totalVmtZev} VMT`
          );
        }
      } catch (err) {
        console.error(`[cpuc] ${label}:`, err);
        result.errors++;
      }
    }

    // -----------------------------------------------------------------------
    // Pilot Program (module 3.4): Zoox and Nuro month-level data, per program.
    // Fetches the pilot zip for the same expected quarters, ingests each
    // configured carrier's driverless month-level rows into ride_estimates
    // keyed by program_id with tier 'pilot'. A carrier folder that is
    // absent from a quarter's zip is recorded as missing (Nuro will not
    // appear before Q2 2026), never as an error.
    // -----------------------------------------------------------------------
    const { data: programRows } = await client
      .from("operator_programs")
      .select("id, slug")
      .in(
        "slug",
        PILOT_CARRIERS.map((c) => c.programSlug)
      );
    const programIdBySlug = new Map((programRows ?? []).map((p) => [p.slug, p.id]));
    const { data: companyRows } = await client
      .from("companies")
      .select("id, slug")
      .in(
        "slug",
        PILOT_CARRIERS.map((c) => c.companySlug)
      );
    const companyIdBySlug = new Map((companyRows ?? []).map((c) => [c.slug, c.id]));

    const { data: existingPilot } = await client
      .from("ride_estimates")
      .select("id, program_id, period_start, rides_per_week, vehicle_miles_traveled")
      .eq("tier", "pilot");
    const pilotByKey = new Map(
      (existingPilot ?? []).map((r) => [`${r.program_id}|${r.period_start}`, r])
    );

    for (const qt of expected) {
      const label = quarterLabel(qt);
      const { period_start, period_end } = quarterDateRange(qt);
      const isRecent = expected.indexOf(qt) >= expected.length - 2;
      const allPresent = PILOT_CARRIERS.every((c) =>
        pilotByKey.has(`${programIdBySlug.get(c.programSlug)}|${period_start}`)
      );
      if (allPresent && !deepVerify && !isRecent) continue;

      let zipBytes: Uint8Array;
      try {
        await sleep(REQUEST_DELAY_MS);
        const res = await fetch(pilotZipUrl(qt), { headers: { "User-Agent": userAgent } });
        if (res.status === 404) {
          // Same overdue logic as deployment; the pilot zip is posted at the
          // same time, so a missing deployment quarter already produced the
          // warning. Skip quietly here.
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching pilot ${label}`);
        zipBytes = new Uint8Array(await res.arrayBuffer());
      } catch (err) {
        console.error(`[cpuc] pilot ${label}:`, err);
        result.errors++;
        continue;
      }

      const pilotStorageKey = `cpuc/av-pilot-${qt.year}q${qt.q}`;

      for (const carrier of PILOT_CARRIERS) {
        const programId = programIdBySlug.get(carrier.programSlug);
        const companyId = companyIdBySlug.get(carrier.companySlug);
        if (!programId || !companyId) {
          console.warn(`[cpuc] pilot ${carrier.label}: program or company row missing; skipping`);
          continue;
        }
        try {
          const extracted = extractPilotMonthCsv(zipBytes, carrier);
          if (!extracted) {
            result.pilot.missing.push(`${carrier.label} ${label}`);
            continue;
          }
          const totals = aggregateQuarter(parseMonthCsv(extracted.monthCsv), qt);
          if (totals.monthsFound < 3) {
            throw new Error(
              `${carrier.label} ${label}: only ${totals.monthsFound} month(s); skipping partial filing`
            );
          }
          const ridesPerWeek = Math.floor(totals.totalTrips / WEEKS_PER_QUARTER);

          for (const f of extracted.archivable) {
            const { error } = await client.storage
              .from(STORAGE_BUCKET)
              .upload(`${pilotStorageKey}/${f.name}`, f.data.slice().buffer as ArrayBuffer, {
                contentType: /\.csv$/i.test(f.name) ? "text/csv" : "application/octet-stream",
                upsert: true,
              });
            if (error) console.warn(`[cpuc] archive pilot ${f.name}: ${error.message}`);
          }

          const sourceId = await findOrCreateQuarterSource(client, qt, pilotStorageKey, {
            url: pilotZipUrl(qt),
            title: `AV Pilot Program Quarterly Data Reports, ${label}`,
          });

          const methodologyNote =
            `Sourced directly from the California Public Utilities Commission AV Pilot Program ` +
            `quarterly data reports (${pilotZipUrl(qt)}), ${carrier.label} driverless month-level ` +
            `rollup summed across the quarter. Pilot tier: passengers may ride but fares are ` +
            `not permitted, so trips are not paid rides. California operations only. Rides per week ` +
            `normalized using ${WEEKS_PER_QUARTER} weeks per quarter.`;

          const key = `${programId}|${period_start}`;
          const existing = pilotByKey.get(key);
          if (existing) {
            const matches =
              existing.rides_per_week === ridesPerWeek &&
              Math.round(Number(existing.vehicle_miles_traveled ?? 0)) === Math.round(totals.totalVmtZev);
            if (matches) {
              result.pilot.unchanged++;
            } else {
              const { error } = await client
                .from("ride_estimates")
                .update({
                  rides_per_week: ridesPerWeek,
                  vehicle_miles_traveled: totals.totalVmtZev,
                  source_id: sourceId,
                  methodology_note: methodologyNote,
                })
                .eq("id", existing.id as string);
              if (error) throw new Error(error.message);
              result.pilot.updated++;
            }
          } else {
            const { error } = await client.from("ride_estimates").insert({
              company_id: companyId,
              program_id: programId,
              tier: "pilot",
              city_id: null,
              period_start,
              period_end,
              rides_per_week: ridesPerWeek,
              vehicle_miles_traveled: totals.totalVmtZev,
              source_id: sourceId,
              confidence: "high",
              methodology_note: methodologyNote,
            });
            if (error) throw new Error(error.message);
            result.pilot.inserted++;
            console.log(
              `[cpuc] pilot ${carrier.label} ${label} inserted: ${totals.totalTrips} trips, ${Math.round(totals.totalVmtZev)} VMT`
            );
          }
        } catch (err) {
          console.error(`[cpuc] pilot ${carrier.label} ${label}:`, err);
          result.errors++;
        }
      }
    }

    // Recompute DB quarter list for the summary.
    const { data: finalRows } = await client
      .from("ride_estimates")
      .select("period_start")
      .eq("company_id", waymoId)
      .is("city_id", null)
      .order("period_start", { ascending: true });
    result.dbQuarters = (finalRows ?? []).map((r) => {
      const d = new Date((r.period_start as string) + "T00:00:00Z");
      return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    });

    const parts = [
      `CPUC scrape: ${result.inserted} inserted, ${result.updated} updated, ` +
        `${result.unchanged} unchanged, ${result.errors} errors.`,
      `DB quarters: ${result.dbQuarters.join(", ") || "none"}.`,
    ];
    parts.push(
      `Pilot (Zoox, Nuro): ${result.pilot.inserted} inserted, ${result.pilot.updated} updated, ` +
        `${result.pilot.unchanged} unchanged` +
        (result.pilot.missing.length > 0 ? `; not in filing: ${result.pilot.missing.join(", ")}` : "") +
        `.`
    );
    if (result.notYetPosted.length > 0) {
      parts.push(
        `Awaiting CPUC: ${result.notYetPosted.join(", ")} (within normal lag).`
      );
    }
    if (result.overdue.length > 0) {
      parts.push(
        `OVERDUE at CPUC: ${result.overdue.join(", ")} (past deadline plus ${OVERDUE_GRACE_DAYS}-day grace). Check ${CPUC_PAGE_URL}`
      );
    }
    const level =
      result.errors > 0 || result.overdue.length > 0 ? "warn" : "info";
    await notifySlack(parts.join(" "), level);
  } catch (fatalErr) {
    const msg = `CPUC scraper fatal error: ${
      fatalErr instanceof Error ? fatalErr.message : String(fatalErr)
    }`;
    console.error(`[cpuc] ${msg}`);
    await notifySlack(msg, "error");
    result.errors++;
  }

  return result;
}
