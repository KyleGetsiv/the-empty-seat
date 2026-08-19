"use client";

// Lazy-loads CoverageMap with ssr: false so mapbox-gl never runs on the server.
// Import this wrapper instead of CoverageMap directly. Also renders the legend:
// the state tiers come back from the map (only steps actually present are
// listed), the cohort ramp is derived here from the same launch dates the map
// colors by.

import dynamic from "next/dynamic";
import { useState } from "react";
import type { MapCity } from "./CoverageMap";
import { getBucketLegend } from "@/lib/cohorts";
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

// Neutral, so the shape key reads as shape and does not imply a dot color.
const SHAPE_INK = "#6B6B6B";

export function CoverageMapClient({ cities }: { cities: MapCity[] }) {
  const [tiers, setTiers] = useState<Record<string, StateTier> | null>(null);
  const present = tiers ? tiersPresent(tiers) : [];
  const cohorts = getBucketLegend(cities.map((c) => c.launch_date));

  return (
    <div>
      <CoverageMapInner cities={cities} onTiers={setTiers} />

      {present.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
          <span className="w-24 shrink-0 text-foreground">State shading</span>
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
            Presence in a state, not statewide coverage.
          </span>
        </div>
      )}

      {cohorts.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
          <span className="w-24 shrink-0 text-foreground">Dot color</span>
          {cohorts.map((c) => (
            <span key={c.index} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              {c.label}
            </span>
          ))}
          <span className="w-full text-[11px] leading-relaxed sm:w-auto sm:ml-auto">
            Year the market launched, not its size.
          </span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
        <span className="w-24 shrink-0 text-foreground">Dot shape</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: SHAPE_INK }}
          />
          public
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-background"
            style={{ border: `2px solid ${SHAPE_INK}` }}
          />
          waitlist or employee only
        </span>
        <span className="w-full text-[11px] leading-relaxed sm:w-auto sm:ml-auto">
          Dots are uniform in size; service areas draw to true scale as you zoom
          in, and a city with none drawn has not disclosed one.
        </span>
      </div>
    </div>
  );
}
