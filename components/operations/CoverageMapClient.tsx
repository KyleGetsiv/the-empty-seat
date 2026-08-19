"use client";

// Lazy-loads CoverageMap with ssr: false so mapbox-gl never runs on the server.
// Import this wrapper instead of CoverageMap directly. Also renders the state
// fill legend, which cannot be built until the map reports which tiers the
// current roster actually produced.

import dynamic from "next/dynamic";
import { useState } from "react";
import type { MapCity } from "./CoverageMap";
import {
  STATE_TIER_COLORS,
  WAYMO_TIER_LABEL,
  tiersPresent,
  type StateTier,
} from "@/lib/state-tiers";

export type { MapCity } from "./CoverageMap";

const CoverageMapInner = dynamic(
  () => import("./CoverageMap").then((m) => ({ default: m.CoverageMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="mt-10 w-full animate-pulse rounded-md border border-border bg-surface"
        style={{ height: "65vh", minHeight: "360px" }}
        aria-label="Loading coverage map"
      />
    ),
  }
);

export function CoverageMapClient({ cities }: { cities: MapCity[] }) {
  const [tiers, setTiers] = useState<Record<string, StateTier> | null>(null);
  const present = tiers ? tiersPresent(tiers) : [];

  return (
    <div>
      <CoverageMapInner cities={cities} onTiers={setTiers} />
      {present.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
          <span className="text-foreground">State shading</span>
          {present.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-4 rounded-[2px] border border-border"
                style={{ backgroundColor: STATE_TIER_COLORS[t] }}
              />
              {WAYMO_TIER_LABEL[t]}
            </span>
          ))}
          <span className="w-full text-[11px] leading-relaxed sm:w-auto sm:ml-auto">
            Shading marks presence in a state, not statewide coverage.
          </span>
        </div>
      )}
    </div>
  );
}
