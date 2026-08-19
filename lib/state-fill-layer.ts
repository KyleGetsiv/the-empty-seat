// lib/state-fill-layer.ts
// Shared Mapbox wiring for the state presence fill used by CoverageMap
// (Waymo) and OperatorMap (landscape). Kept out of state-tiers.ts so that
// module stays pure and testable with no mapbox-gl dependency.

import type mapboxgl from "mapbox-gl";
import {
  computeStateTiers,
  tierFillExpression,
  type StateTier,
  type StatesFeatureCollection,
  type TierCity,
} from "./state-tiers";

export const STATES_URL = "/us-states.json";

// The fill belongs above the base landmass but below water, roads, and labels,
// otherwise a solid choropleth buries the geography that makes it legible.
function insertionPoint(map: mapboxgl.Map): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  const water = layers.find((l) => l.id.includes("water"));
  if (water) return water.id;
  const line = layers.find((l) => l.type === "line");
  if (line) return line.id;
  return layers.find((l) => l.type === "symbol")?.id;
}

interface Options {
  // Reduce on maps that draw translucent shapes on top (the Waymo cohort
  // circles are 25% opacity fills and vanish over a full-strength ramp).
  fillOpacity: number;
  sourceId?: string;
}

// Returns the computed tiers so the caller can render a legend that only lists
// steps actually present. Resolves to null if the fetch fails or the map went
// away first; the maps stay fully functional without the fill.
export async function addStateFill(
  map: mapboxgl.Map,
  cities: TierCity[],
  { fillOpacity, sourceId = "us-states" }: Options
): Promise<Record<string, StateTier> | null> {
  let states: StatesFeatureCollection;
  try {
    const res = await fetch(STATES_URL);
    if (!res.ok) return null;
    states = (await res.json()) as StatesFeatureCollection;
  } catch {
    return null;
  }

  // The map may have been torn down while the fetch was in flight.
  if (!map.getStyle || !map.getStyle()) return null;
  if (map.getSource(sourceId)) return null;

  const tiers = computeStateTiers(cities, states);
  const before = insertionPoint(map);

  map.addSource(sourceId, { type: "geojson", data: states });

  map.addLayer(
    {
      id: `${sourceId}-fill`,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": tierFillExpression(tiers) as never,
        "fill-opacity": fillOpacity,
      },
    },
    before
  );

  map.addLayer(
    {
      id: `${sourceId}-outline`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#DCDCD5",
        "line-width": 0.6,
        "line-opacity": 0.9,
      },
    },
    before
  );

  return tiers;
}
