"use client";

// Lazy-loads OperatorMap with ssr: false so mapbox-gl never runs on the
// server. Also renders the program legend and, on the US frame, the state
// presence legend, both of which need data the map computes or owns.

import dynamic from "next/dynamic";
import { useState } from "react";
import { programColor } from "./OperatorMap";
import type { LandscapeCity, Supervision } from "@/lib/landscape-types";
import {
  STATE_TIER_COLORS,
  STATE_TIER_LABEL,
  tiersPresent,
  type StateTier,
} from "@/lib/state-tiers";

const OperatorMapInner = dynamic(
  () => import("./OperatorMap").then((m) => ({ default: m.OperatorMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full animate-pulse rounded-md border border-border bg-surface"
        style={{ height: "55vh", minHeight: "320px" }}
        aria-label="Loading operator map"
      />
    ),
  }
);

export function OperatorMapClient({
  cities,
  region,
  supervisionByProgram,
}: {
  cities: LandscapeCity[];
  region: "us" | "world";
  supervisionByProgram?: Record<string, Supervision | null>;
}) {
  const [tiers, setTiers] = useState<Record<string, StateTier> | null>(null);
  const present = region === "us" && tiers ? tiersPresent(tiers) : [];

  const programs = Array.from(
    new Map(cities.map((c) => [c.program_slug, c.program_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div>
      <OperatorMapInner
        cities={cities}
        region={region}
        supervisionByProgram={supervisionByProgram}
        onTiers={setTiers}
      />

      {present.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
          <span className="text-foreground">State shading</span>
          {present.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-4 rounded-[2px] border border-border"
                style={{ backgroundColor: STATE_TIER_COLORS[t] }}
              />
              {STATE_TIER_LABEL[t]}
            </span>
          ))}
          <span className="w-full text-[11px] leading-relaxed sm:w-auto sm:ml-auto">
            Presence, not statewide coverage. Programs running with a safety
            operator or driver do not shade a state.
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        {programs.map(([slug, name]) => (
          <span key={slug} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: programColor(slug) }}
            />
            {name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 ml-auto">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground" /> public
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background ml-3" /> limited
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-muted bg-background ml-3" /> announced
        </span>
      </div>
    </div>
  );
}
