"use client";

// Lazy-loads OperatorMap with ssr: false so mapbox-gl never runs on the
// server. Also renders the program legend, which needs the color map.

import dynamic from "next/dynamic";
import { programColor } from "./OperatorMap";
import type { LandscapeCity } from "@/lib/landscape-types";

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
}: {
  cities: LandscapeCity[];
  region: "us" | "world";
}) {
  const programs = Array.from(
    new Map(cities.map((c) => [c.program_slug, c.program_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div>
      <OperatorMapInner cities={cities} region={region} />
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
