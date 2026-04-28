// lib/cohorts.ts
// Single source of truth for cohort bucketing and color assignment.
// Both CoverageMap and CohortRampChart import from here.
//
// Buckets are computed from a city's launch_date using wider bands for
// older launches and narrower bands for recent years, giving newer
// cohorts more visual granularity.
//
// Bucket numbering: 1 = oldest, 5 = newest. Maps to --color-cohort-N
// tokens in globals.css.

export interface CohortBucket {
  index: 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
}

const COHORT_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "#0D1E32",
  2: "#1E3A5F",
  3: "#3D6A9E",
  4: "#7BAAD0",
  5: "#B8D4E8",
};

// Returns the cohort bucket for a given launch_date string ("YYYY-MM-DD").
// Bucket boundaries:
//   1: 2020 through 2022 (earliest markets)
//   2: 2023
//   3: 2024
//   4: 2025
//   5: 2026 onward
export function getCohortBucket(launchDate: string): CohortBucket {
  const year = new Date(launchDate).getUTCFullYear();

  if (year <= 2022) return { index: 1, label: "2020-2022", color: COHORT_COLORS[1] };
  if (year === 2023) return { index: 2, label: "2023",     color: COHORT_COLORS[2] };
  if (year === 2024) return { index: 3, label: "2024",     color: COHORT_COLORS[3] };
  if (year === 2025) return { index: 4, label: "2025",     color: COHORT_COLORS[4] };
  return               { index: 5, label: "2026+",    color: COHORT_COLORS[5] };
}

// Returns all distinct buckets present in a set of launch dates, sorted
// oldest to newest. Useful for rendering chart legends.
export function getBucketLegend(launchDates: string[]): CohortBucket[] {
  const seen = new Map<number, CohortBucket>();
  for (const d of launchDates) {
    const b = getCohortBucket(d);
    if (!seen.has(b.index)) seen.set(b.index, b);
  }
  return Array.from(seen.values()).sort((a, b) => a.index - b.index);
}
