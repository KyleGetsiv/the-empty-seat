// lib/disclosed-metrics.ts
// v2 (module 2.3): reads from the disclosed_metrics table, which replaced
// the site_content latest_*_disclosed text convention. Rows are point-in-
// time public disclosures. Headline surfaces (hero, KeyStats) use the
// latest COMPANY-attributed row only; charts show all attributions and
// render third-party rows (investor/media/analyst) as open dots.

import { createSupabaseServerClient } from "./supabase/server";

export interface DisclosedSource {
  id: string;
  url: string;
  publisher: string;
  title: string;
  published_at: Date | null;
}

export interface DisclosedWeeklyRides {
  value: number;
  as_of: Date;
  source: DisclosedSource;
}

export interface DisclosedPoint {
  value: number;
  as_of: string; // YYYY-MM-DD
  attribution: "company" | "investor" | "media" | "analyst";
  stated_by: string | null;
  notes: string | null;
  source: DisclosedSource | null;
}

type JoinedRow = {
  value: number;
  as_of: string;
  attribution: string;
  stated_by: string | null;
  notes: string | null;
  source: {
    id: string;
    url: string;
    publisher: string;
    title: string;
    published_at: string | null;
  } | null;
};

function toSource(s: JoinedRow["source"]): DisclosedSource | null {
  if (!s) return null;
  return {
    id: s.id,
    url: s.url,
    publisher: s.publisher,
    title: s.title,
    published_at: s.published_at ? new Date(s.published_at) : null,
  };
}

/**
 * Latest company-attributed weekly rides disclosure, joined to its source.
 * Returns null when the table has no such row; callers fall back to the
 * CPUC-derived value.
 */
export async function getLatestDisclosedWeeklyRides(): Promise<DisclosedWeeklyRides | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("disclosed_metrics")
    .select(
      "value, as_of, attribution, stated_by, notes, source:sources(id, url, publisher, title, published_at)"
    )
    .eq("metric", "weekly_rides")
    .eq("attribution", "company")
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("[disclosed-metrics] weekly_rides query failed:", error.message);
    return null;
  }

  const row = data as unknown as JoinedRow;
  const source = toSource(row.source);
  if (!source) {
    console.warn("[disclosed-metrics] latest weekly_rides row has no source; skipping");
    return null;
  }

  return {
    value: Number(row.value),
    as_of: new Date(row.as_of + "T00:00:00Z"),
    source,
  };
}

/**
 * Full disclosure series for a metric, ascending by as_of, all attributions.
 * Used by the national trajectory chart.
 */
export async function getDisclosedSeries(metric: string): Promise<DisclosedPoint[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("disclosed_metrics")
    .select(
      "value, as_of, attribution, stated_by, notes, source:sources(id, url, publisher, title, published_at)"
    )
    .eq("metric", metric)
    .order("as_of", { ascending: true });

  if (error) {
    console.warn(`[disclosed-metrics] series query failed for ${metric}:`, error.message);
    return [];
  }

  return ((data ?? []) as unknown as JoinedRow[]).map((row) => ({
    value: Number(row.value),
    as_of: row.as_of,
    attribution: (["company", "investor", "media", "analyst"].includes(row.attribution)
      ? row.attribution
      : "company") as DisclosedPoint["attribution"],
    stated_by: row.stated_by,
    notes: row.notes,
    source: toSource(row.source),
  }));
}
