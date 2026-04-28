// lib/scrapers/cpuc.ts
// Scrapes CPUC quarterly Waymo deployment data from Robotaxi Tracker's hosted JSON mirror.
// Primary source: California Public Utilities Commission quarterly AV deployment filings.
// Writes quarterly rows to ride_estimates with city_id = NULL (CA company-wide scope).
//
// Robots.txt note: /data/*.json paths are not disallowed at robotaxitracker.com.
// /api/* paths ARE disallowed and are never called here.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { notifySlack } from "@/lib/notify";

const CPUC_SOURCE = {
  url: "https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting",
  publisher: "California Public Utilities Commission",
  title: "Waymo Quarterly AV Deployment Data",
};

const WAYMO_SLUG = "waymo";
const WEEKS_PER_QUARTER = 13;
const REQUEST_DELAY_MS = 2000;

// Years to attempt fetching. Add new years here as CPUC publishes filings.
const FETCH_YEARS = [2025, 2026];

interface CpucQuarterSummary {
  quarter: string;
  total_trips: number;
  total_vmt_zev: number;
}

interface CpucDataFile {
  schema_version: number;
  generated_at: string;
  quarter_summaries: CpucQuarterSummary[];
}

export interface CpucScrapeResult {
  inserted: number;
  updated: number;
  skipped_dedup: number;
  errors: number;
}

function quarterToDateRange(quarter: string): { period_start: string; period_end: string } {
  const match = quarter.match(/^(\d{4}) Q([1-4])$/);
  if (!match) throw new Error(`Unrecognized quarter format: ${quarter}`);
  const year = parseInt(match[1]);
  const q = parseInt(match[2]);
  const startMonth = (q - 1) * 3;
  const endMonth = startMonth + 2;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, endMonth + 1, 0));
  return {
    period_start: start.toISOString().split("T")[0],
    period_end: end.toISOString().split("T")[0],
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findOrCreateSource(client: SupabaseClient): Promise<string> {
  const { data: existing } = await client
    .from("sources")
    .select("id")
    .eq("url", CPUC_SOURCE.url)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await client
    .from("sources")
    .insert({
      url: CPUC_SOURCE.url,
      publisher: CPUC_SOURCE.publisher,
      title: CPUC_SOURCE.title,
      scraped_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(`Failed to create source row: ${error?.message}`);
  return created.id as string;
}

export async function runCpucScrape(): Promise<CpucScrapeResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result: CpucScrapeResult = { inserted: 0, updated: 0, skipped_dedup: 0, errors: 0 };

  try {
    // Resolve Waymo company_id
    const { data: company, error: companyError } = await client
      .from("companies")
      .select("id")
      .eq("slug", WAYMO_SLUG)
      .single();

    if (companyError || !company) {
      throw new Error(`Could not find company '${WAYMO_SLUG}': ${companyError?.message}`);
    }
    const waymoId = (company as { id: string }).id;

    // Find or create the CPUC sources row
    const sourceId = await findOrCreateSource(client);

    const userAgent = process.env.SCRAPER_USER_AGENT ?? "TheEmptySeat/1.0";
    let firstFetch = true;

    for (const year of FETCH_YEARS) {
      if (!firstFetch) await sleep(REQUEST_DELAY_MS);
      firstFetch = false;

      const fileUrl = `https://robotaxitracker.com/data/cpuc-waymo-deployment-${year}.json`;
      let fileData: CpucDataFile;

      try {
        const res = await fetch(fileUrl, {
          headers: { "User-Agent": userAgent },
        });
        if (res.status === 404) {
          console.log(`[cpuc] No file for ${year} (404), skipping`);
          continue;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${fileUrl}`);
        }
        fileData = (await res.json()) as CpucDataFile;
      } catch (err) {
        console.error(`[cpuc] Failed to fetch ${year} file:`, err);
        result.errors++;
        continue;
      }

      const methodologyNote =
        `Sourced from California Public Utilities Commission quarterly filings; ` +
        `data parsed via Robotaxi Tracker's hosted JSON mirror at ${fileUrl}. ` +
        `California operations only. Rides per week normalized using ${WEEKS_PER_QUARTER} weeks per quarter.`;

      for (const summary of fileData.quarter_summaries) {
        try {
          const { period_start, period_end } = quarterToDateRange(summary.quarter);
          const ridesPerWeek = Math.floor(summary.total_trips / WEEKS_PER_QUARTER);
          const vehicleMiles = summary.total_vmt_zev;

          // Check for existing row
          const { data: existing } = await client
            .from("ride_estimates")
            .select("id, rides_per_week, vehicle_miles_traveled")
            .eq("company_id", waymoId)
            .is("city_id", null)
            .eq("period_start", period_start)
            .maybeSingle();

          if (existing) {
            const existingRow = existing as {
              id: string;
              rides_per_week: number;
              vehicle_miles_traveled: number | null;
            };
            const valuesMatch =
              existingRow.rides_per_week === ridesPerWeek &&
              Number(existingRow.vehicle_miles_traveled) === vehicleMiles;

            if (valuesMatch) {
              result.skipped_dedup++;
              continue;
            }

            // CPUC restatement: update in place
            const { error: updateError } = await client
              .from("ride_estimates")
              .update({
                rides_per_week: ridesPerWeek,
                vehicle_miles_traveled: vehicleMiles,
                methodology_note: methodologyNote,
              })
              .eq("id", existingRow.id);

            if (updateError) {
              console.error(`[cpuc] Update failed for ${summary.quarter}:`, updateError.message);
              result.errors++;
            } else {
              result.updated++;
            }
          } else {
            const { error: insertError } = await client.from("ride_estimates").insert({
              company_id: waymoId,
              city_id: null,
              period_start,
              period_end,
              rides_per_week: ridesPerWeek,
              vehicle_miles_traveled: vehicleMiles,
              source_id: sourceId,
              confidence: "high",
              methodology_note: methodologyNote,
            });

            if (insertError) {
              console.error(`[cpuc] Insert failed for ${summary.quarter}:`, insertError.message);
              result.errors++;
            } else {
              result.inserted++;
            }
          }
        } catch (quarterErr) {
          console.error(`[cpuc] Error processing quarter ${summary.quarter}:`, quarterErr);
          result.errors++;
        }
      }
    }

    const summary =
      `CPUC scrape complete: ${result.inserted} inserted, ${result.updated} updated, ` +
      `${result.skipped_dedup} skipped (dedup), ${result.errors} errors`;
    console.log(`[cpuc] ${summary}`);
    await notifySlack(summary, result.errors > 0 ? "warn" : "info");
  } catch (fatalErr) {
    const msg = `CPUC scraper fatal error: ${fatalErr instanceof Error ? fatalErr.message : String(fatalErr)}`;
    console.error(`[cpuc] ${msg}`);
    await notifySlack(msg, "error");
    result.errors++;
  }

  return result;
}
