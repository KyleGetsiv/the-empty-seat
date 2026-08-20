// lib/earnings-posture.ts
//
// Client-safe. How Alphabet's disclosure about Waymo changes quarter to
// quarter (module 4.6b).
//
// This replaces the metrics-evolution view the 4.6 plan called for. That view
// assumed a corpus of figures; the corpus is actually 162 approved statements
// carrying 4 published figures, overwhelmingly strategy commentary. Four
// points is not an evolution, and the homepage NationalTrajectory already
// charts the disclosed arc from `disclosed_metrics` with more points than the
// earnings pipeline has produced.
//
// So this answers the question the corpus can actually support: not how fast
// Waymo grew, but how Alphabet's willingness to talk about it changed. For a
// company that gives Waymo no segment, no revenue line and no margin, the
// register they choose is close to the only first-party signal there is. It
// still satisfies the standing constraint that this section must not redraw
// the homepage arc, because it is not about rides at all.

import { periodGroupKey, periodSortValue, periodGroupLabel } from "@/lib/earnings-slug";
import type { PublicEarningsEvent } from "@/lib/earnings-types";

export type Register = "quantified" | "strategy" | "positioning" | "other";

// Eleven mention types collapse to four registers. The collapse is an
// editorial judgement and is stated on the page, with the full mapping shown,
// so a reader can see what was folded into what. Per-type counts stay
// available in each cell's title text; nothing is discarded.
export const REGISTER_OF: Record<string, Register> = {
  revenue_reference: "quantified",
  city_count: "quantified",
  ride_count: "quantified",
  fleet_size: "quantified",
  capex: "quantified",
  operating_loss: "quantified",
  strategic_commentary: "strategy",
  forward_guidance: "strategy",
  competitive_reference: "positioning",
  safety_reference: "positioning",
  other: "other",
};

export const REGISTER_ORDER: Register[] = ["quantified", "strategy", "positioning", "other"];

export const REGISTER_LABELS: Record<Register, string> = {
  quantified: "Numbers",
  strategy: "Strategy and guidance",
  positioning: "Competition and safety",
  other: "Uncategorized",
};

export const REGISTER_BLURBS: Record<Register, string> = {
  quantified: "A figure was attached: rides, cities, fleet, revenue, capex or operating loss.",
  strategy: "What Alphabet says it is doing and expects to do.",
  positioning: "Waymo placed against rivals, or discussed in terms of safety.",
  other: "Approved as relevant but fitting none of the above.",
};

export function registerOf(mentionType: string): Register {
  return REGISTER_OF[mentionType] ?? "other";
}

export interface PostureQuarter {
  key: string;
  label: string;
  documents: number;
  total: number;
}

export interface PostureCell {
  quarterKey: string;
  count: number;
  // Per mention type, so the collapse to four registers stays auditable.
  byType: Array<{ type: string; count: number }>;
}

export interface PostureRow {
  register: Register;
  cells: PostureCell[];
  total: number;
}

export interface PostureMatrix {
  quarters: PostureQuarter[];
  rows: PostureRow[];
  grandTotal: number;
  peak: PostureQuarter | null;
  // Quarters where documents were published and reviewed but nothing about
  // Waymo was approved. The silences are the point of the section.
  silentQuarters: PostureQuarter[];
  dominant: { register: Register; total: number } | null;
}

// Quarters come from every event, not only events with mentions, so a quarter
// in which Alphabet filed and said nothing still gets a column.
export function buildPostureMatrix(events: PublicEarningsEvent[]): PostureMatrix {
  const byQuarter = new Map<string, PublicEarningsEvent[]>();
  for (const event of events) {
    const key = periodGroupKey(event.fiscalPeriod);
    byQuarter.set(key, [...(byQuarter.get(key) ?? []), event]);
  }

  // Oldest first: this section reads left to right as time.
  const quarterKeys = [...byQuarter.keys()].sort((a, b) => periodSortValue(a) - periodSortValue(b));

  const quarters: PostureQuarter[] = quarterKeys.map((key) => {
    const group = byQuarter.get(key) ?? [];
    return {
      key,
      label: periodGroupLabel(
        key,
        group.map((e) => e.fiscalPeriod)
      ),
      documents: group.length,
      total: group.reduce((n, e) => n + e.mentions.length, 0),
    };
  });

  const rows: PostureRow[] = REGISTER_ORDER.map((register) => {
    const cells: PostureCell[] = quarterKeys.map((key) => {
      const group = byQuarter.get(key) ?? [];
      const counts = new Map<string, number>();
      let count = 0;
      for (const event of group) {
        for (const m of event.mentions) {
          if (registerOf(m.mentionType) !== register) continue;
          count++;
          counts.set(m.mentionType, (counts.get(m.mentionType) ?? 0) + 1);
        }
      }
      return {
        quarterKey: key,
        count,
        byType: [...counts.entries()]
          .map(([type, c]) => ({ type, count: c }))
          .sort((a, b) => b.count - a.count),
      };
    });
    return { register, cells, total: cells.reduce((n, c) => n + c.count, 0) };
  });

  const grandTotal = quarters.reduce((n, q) => n + q.total, 0);
  const peak = quarters.reduce<PostureQuarter | null>(
    (best, q) => (best === null || q.total > best.total ? q : best),
    null
  );
  const dominant = rows.reduce<{ register: Register; total: number } | null>(
    (best, r) => (best === null || r.total > best.total ? { register: r.register, total: r.total } : best),
    null
  );

  return {
    quarters,
    rows,
    grandTotal,
    peak: peak && peak.total > 0 ? peak : null,
    silentQuarters: quarters.filter((q) => q.total === 0),
    dominant: dominant && dominant.total > 0 ? dominant : null,
  };
}

// Shading step for a cell, 0 through 4. Scaled against the busiest cell so a
// quiet corpus still shows contrast, and never returns a nonzero step for a
// zero count: an empty cell must read as empty, not as faint.
export function shadeStep(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((count / max) * 4)));
}

export function maxCellCount(matrix: PostureMatrix): number {
  return matrix.rows.reduce(
    (max, row) => row.cells.reduce((m, c) => Math.max(m, c.count), max),
    0
  );
}
