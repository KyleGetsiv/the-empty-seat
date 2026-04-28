"use client";

// Lazy-loads CoverageMap with ssr: false so mapbox-gl never runs on the server.
// Import this wrapper instead of CoverageMap directly.

import dynamic from "next/dynamic";

export type { MapCity } from "./CoverageMap";

export const CoverageMapClient = dynamic(
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
