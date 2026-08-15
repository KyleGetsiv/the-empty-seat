// lib/landscape.ts
// Server data layer for the competitive landscape page (module 3.3). Reads
// operator programs, their company roles, the latest competitor snapshot
// per program, and competitor cities. Server-only. Types and display
// helpers live in lib/landscape-types.ts (client-safe).

import { createSupabaseServerClient } from "./supabase/server";
import type {
  Supervision,
  DisclosureQuality,
  Role,
  LandscapeCompany,
  LandscapeSnapshot,
  LandscapeProgram,
  LandscapeCity,
} from "./landscape-types";

export type * from "./landscape-types";
export {
  SUPERVISION_LABEL,
  QUALITY_LABEL,
  ROLE_LABEL,
  isDriverlessPublic,
} from "./landscape-types";

export async function getLandscapePrograms(): Promise<LandscapeProgram[]> {
  const supabase = await createSupabaseServerClient();

  const [{ data: programs }, { data: roles }, { data: snapshots }] = await Promise.all([
    supabase
      .from("operator_programs")
      .select(
        "id, slug, display_name, summary, is_active, lead:companies!operator_programs_lead_company_id_fkey(id, slug, display_name, hq_country, ownership, status_summary)"
      )
      .eq("is_active", true),
    supabase
      .from("operator_program_roles")
      .select("program_id, role, company:companies(id, slug, display_name, hq_country, ownership, status_summary)"),
    supabase
      .from("competitor_snapshots")
      .select(
        "program_id, snapshot_date, cities_serving_public, cities_operating_total, vehicle_count, weekly_rides, cumulative_rides, autonomous_miles_cumulative, funding_total_usd, implied_valuation_usd, supervision, disclosure_quality, notes, source:sources(url, publisher, title)"
      )
      .order("snapshot_date", { ascending: false }),
  ]);

  type RawCompany = LandscapeCompany;
  const rolesByProgram = new Map<string, { company: RawCompany; role: Role }[]>();
  for (const r of roles ?? []) {
    const c = r.company as unknown as RawCompany | null;
    if (!c) continue;
    const list = rolesByProgram.get(r.program_id) ?? [];
    list.push({ company: c, role: r.role as Role });
    rolesByProgram.set(r.program_id, list);
  }

  // Latest snapshot per program (query is date-desc, so first wins).
  const latestByProgram = new Map<string, LandscapeSnapshot>();
  for (const s of snapshots ?? []) {
    if (latestByProgram.has(s.program_id)) continue;
    latestByProgram.set(s.program_id, {
      snapshot_date: s.snapshot_date,
      cities_serving_public: s.cities_serving_public,
      cities_operating_total: s.cities_operating_total,
      vehicle_count: s.vehicle_count,
      weekly_rides: s.weekly_rides,
      cumulative_rides: s.cumulative_rides == null ? null : Number(s.cumulative_rides),
      autonomous_miles_cumulative:
        s.autonomous_miles_cumulative == null ? null : Number(s.autonomous_miles_cumulative),
      funding_total_usd: s.funding_total_usd == null ? null : Number(s.funding_total_usd),
      implied_valuation_usd:
        s.implied_valuation_usd == null ? null : Number(s.implied_valuation_usd),
      supervision: (s.supervision as Supervision | null) ?? null,
      disclosure_quality: s.disclosure_quality as DisclosureQuality,
      notes: s.notes,
      source: (s.source as unknown as LandscapeSnapshot["source"]) ?? null,
    });
  }

  const out: LandscapeProgram[] = (programs ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    display_name: p.display_name,
    summary: p.summary,
    lead: p.lead as unknown as LandscapeCompany,
    roles: rolesByProgram.get(p.id) ?? [],
    snapshot: latestByProgram.get(p.id) ?? null,
  }));

  return out;
}

export async function getLandscapeCities(): Promise<LandscapeCity[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("cities")
    .select(
      "id, name, country, status, launch_date, latitude, longitude, notes, program:operator_programs(slug, display_name)"
    )
    .not("program_id", "is", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  return (data ?? []).map((c) => {
    const p = c.program as unknown as { slug: string; display_name: string } | null;
    return {
      id: c.id,
      program_slug: p?.slug ?? "",
      program_name: p?.display_name ?? "",
      name: c.name,
      country: c.country,
      status: c.status,
      launch_date: c.launch_date,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      notes: c.notes,
    };
  });
}

// Waymo's own cities for the multi-operator map (Waymo rows have no
// program_id, so they are joined here by company slug).
export async function getWaymoCitiesForMap(): Promise<LandscapeCity[]> {
  const supabase = await createSupabaseServerClient();
  const { data: waymo } = await supabase.from("companies").select("id").eq("slug", "waymo").single();
  if (!waymo) return [];
  const { data } = await supabase
    .from("cities")
    .select("id, name, country, status, launch_date, latitude, longitude, notes")
    .eq("company_id", waymo.id)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  return (data ?? []).map((c) => ({
    id: c.id,
    program_slug: "waymo-one",
    program_name: "Waymo One",
    name: c.name,
    country: c.country,
    status: c.status,
    launch_date: c.launch_date,
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    notes: c.notes,
  }));
}
