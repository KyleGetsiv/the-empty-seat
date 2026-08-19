// lib/state-tiers.ts
// Client-safe (no Supabase imports). Computes the US state fill tiers that sit
// beneath the markers on both Mapbox maps.
//
// The fill answers one question: what is the most advanced driverless service a
// state has actually reached. It is deliberately NOT a count of deployments.
// A count would put Tesla's safety-driver Bay Area service on the same axis as
// Waymo's paid driverless service, which is exactly the laundering principle 9
// forbids.
//
// Supervised operations do not move the fill at all. Every state that hosts a
// supervised-only program (Tesla's seven metros, Avride Dallas, Motional Las
// Vegas, Nuro/Lucid/Uber in the Bay Area and Houston) also hosts driverless
// paid service, so a "supervised" band would never render anyway; advertising a
// legend step that never appears is worse than omitting it. The supervision
// argument lives on the SupervisionStrip and in the OperatorTable, which can
// make it per program rather than per state.
//
// The fill is presence, not coverage: Waymo serving SF and LA does not mean
// California is covered. Callers must label it accordingly.

import type { Supervision } from "./landscape-types";

export type StateTier = 1 | 2 | 3;

// Pale single-hue ramp off the editorial accent (#1E3A5F). The darkest step
// stays lighter than any marker so dots and service-area circles read on top.
export const STATE_TIER_COLORS: Record<StateTier, string> = {
  1: "#EDF2F7",
  2: "#C6D4E2",
  3: "#9FB6CC",
};

export const STATE_TIER_LABEL: Record<StateTier, string> = {
  1: "Announced or testing",
  2: "Driverless, limited access",
  3: "Driverless, open to the public",
};

// Waymo-only wording for the operations map, where every row is one company.
export const WAYMO_TIER_LABEL: Record<StateTier, string> = {
  1: "Announced",
  2: "Driverless, waitlist or employee only",
  3: "Open to the public",
};

export const NO_TIER_COLOR = "#FFFFFF";

// A program counts toward the fill only if it runs without a human responsible
// for the driving task. 'mixed' qualifies because at least some of its markets
// are driverless; per-city supervision is not modelled.
export function supervisionCountsAsDriverless(s: Supervision | null | undefined): boolean {
  return s === "driverless" || s === "mixed";
}

// cities.status maps to a tier. 'paused' sits at tier 1: the market is not
// serving anyone today, and pretending otherwise would overstate the map.
export function tierForStatus(status: string): StateTier | null {
  switch (status) {
    case "public":
      return 3;
    case "waitlist":
    case "employee":
      return 2;
    case "announced":
    case "paused":
      return 1;
    default:
      return null;
  }
}

export interface TierCity {
  status: string;
  latitude: number;
  longitude: number;
  // Omit or pass true for single-company maps where supervision is not in play.
  driverless?: boolean;
  // Only used for the development-time unmatched warning below.
  name?: string;
}

// --- point in polygon -------------------------------------------------------

type Ring = number[][];

function bboxOf(geom: GeoJSON.Geometry): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c: unknown): void => {
    const arr = c as number[] | unknown[];
    if (typeof (arr as number[])[0] === "number") {
      const [x, y] = arr as number[];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    for (const inner of arr as unknown[]) walk(inner);
  };
  if ("coordinates" in geom) walk((geom as { coordinates: unknown }).coordinates);
  return [minX, minY, maxX, maxY];
}

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Outer ring contains the point and no hole excludes it.
function inPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !inRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (inRing(lng, lat, rings[i])) return false;
  }
  return true;
}

export function pointInGeometry(lng: number, lat: number, geom: GeoJSON.Geometry): boolean {
  if (geom.type === "Polygon") return inPolygon(lng, lat, geom.coordinates as Ring[]);
  if (geom.type === "MultiPolygon") {
    return (geom.coordinates as Ring[][]).some((poly) => inPolygon(lng, lat, poly));
  }
  return false;
}

// --- tier assignment --------------------------------------------------------

export interface StatesFeatureCollection extends GeoJSON.FeatureCollection {
  features: (GeoJSON.Feature & { properties: { st: string; name: string } })[];
}

// Highest tier wins per state. Cities outside the US (or in the ocean, if a
// lat/lng is wrong) simply match no state and are ignored.
export function computeStateTiers(
  cities: TierCity[],
  states: StatesFeatureCollection
): Record<string, StateTier> {
  const boxes = states.features.map((f) => ({
    st: f.properties.st,
    bbox: bboxOf(f.geometry),
    geom: f.geometry,
  }));

  const out: Record<string, StateTier> = {};
  const unmatched: string[] = [];

  for (const city of cities) {
    if (city.driverless === false) continue;
    const tier = tierForStatus(city.status);
    if (tier === null) continue;
    if (!Number.isFinite(city.latitude) || !Number.isFinite(city.longitude)) continue;

    let hit = false;
    for (const b of boxes) {
      const [minX, minY, maxX, maxY] = b.bbox;
      if (city.longitude < minX || city.longitude > maxX) continue;
      if (city.latitude < minY || city.latitude > maxY) continue;
      if (!pointInGeometry(city.longitude, city.latitude, b.geom)) continue;
      if ((out[b.st] ?? 0) < tier) out[b.st] = tier;
      hit = true;
      break;
    }
    if (!hit) unmatched.push(city.name ?? `${city.latitude},${city.longitude}`);
  }

  // A US city that matches no polygon is silently missing from the fill, which
  // is exactly how the first cut of the boundary asset lost San Francisco and
  // Washington DC to over-simplification. International cities land here too
  // and are expected, so this is a development-time signal, not an error.
  if (process.env.NODE_ENV !== "production" && unmatched.length > 0) {
    console.warn(
      `[state-tiers] ${unmatched.length} city/cities matched no US state (expected for non-US markets): ${unmatched.join(", ")}`
    );
  }

  return out;
}

// Mapbox 'match' expression over the state postal code, so the fill is a single
// data-driven layer rather than one layer per tier.
export function tierFillExpression(tiers: Record<string, StateTier>): unknown {
  const entries = Object.entries(tiers);
  if (entries.length === 0) return NO_TIER_COLOR;
  const expr: unknown[] = ["match", ["get", "st"]];
  for (const [st, tier] of entries) expr.push(st, STATE_TIER_COLORS[tier]);
  expr.push(NO_TIER_COLOR);
  return expr;
}

// Which tiers are actually present, so a legend never advertises an empty step.
export function tiersPresent(tiers: Record<string, StateTier>): StateTier[] {
  const seen = new Set<StateTier>(Object.values(tiers));
  return ([1, 2, 3] as StateTier[]).filter((t) => seen.has(t));
}
