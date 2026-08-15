// lib/landscape-types.ts
// Types and pure display helpers for the competitive landscape. Client-safe:
// no Supabase imports. Server data access lives in lib/landscape.ts.

export type Supervision =
  | "driverless"
  | "safety_operator"
  | "mixed"
  | "human_is_legal_driver";

export type DisclosureQuality =
  | "regulatory"
  | "company_disclosed"
  | "earnings_disclosed"
  | "press_reported"
  | "estimated";

export type Role = "av_developer" | "vehicle_platform" | "fleet_operator" | "network";

export interface LandscapeCompany {
  id: string;
  slug: string;
  display_name: string;
  hq_country: string | null;
  ownership: string | null;
  status_summary: string | null;
}

export interface LandscapeSnapshot {
  snapshot_date: string;
  cities_serving_public: number | null;
  cities_operating_total: number | null;
  vehicle_count: number | null;
  weekly_rides: number | null;
  cumulative_rides: number | null;
  autonomous_miles_cumulative: number | null;
  funding_total_usd: number | null;
  implied_valuation_usd: number | null;
  supervision: Supervision | null;
  disclosure_quality: DisclosureQuality;
  notes: string | null;
  source: { url: string; publisher: string; title: string } | null;
}

export interface LandscapeProgram {
  id: string;
  slug: string;
  display_name: string;
  summary: string | null;
  lead: LandscapeCompany;
  roles: { company: LandscapeCompany; role: Role }[];
  snapshot: LandscapeSnapshot | null;
}

export interface LandscapeCity {
  id: string;
  program_slug: string;
  program_name: string;
  name: string;
  country: string;
  status: string;
  launch_date: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
}

// Display helpers shared by landscape components.

export const SUPERVISION_LABEL: Record<Supervision, string> = {
  driverless: "Driverless",
  safety_operator: "Safety operator",
  mixed: "Mixed",
  human_is_legal_driver: "Human is legal driver",
};

export const QUALITY_LABEL: Record<DisclosureQuality, string> = {
  regulatory: "Regulatory filing",
  company_disclosed: "Company disclosed",
  earnings_disclosed: "Earnings disclosure",
  press_reported: "Press reported",
  estimated: "Estimate",
};

export const ROLE_LABEL: Record<Role, string> = {
  av_developer: "AV developer",
  vehicle_platform: "Vehicle",
  fleet_operator: "Fleet operator",
  network: "Network",
};

// Programs whose latest snapshot indicates a paid, public, driverless service
// somewhere. Used by the supervision strip.
export function isDriverlessPublic(p: LandscapeProgram): boolean {
  const s = p.snapshot;
  if (!s) return false;
  return (
    (s.supervision === "driverless" || s.supervision === "mixed") &&
    (s.cities_serving_public ?? 0) > 0
  );
}

// CPUC regulatory comparison series (module 3.4).
export interface CpucSeriesPoint {
  quarter: string;
  period_start: string;
  trips: number;
  vmt: number | null;
}

export interface CpucComparisonSeries {
  key: string;
  label: string;
  tier: "deployment" | "pilot";
  points: CpucSeriesPoint[];
}
