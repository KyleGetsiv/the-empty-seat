// lib/cpuc-calendar.ts
// CPUC quarterly filing calendar: pure date logic, safe to import from both
// server code (scraper, health cron) and client components (chart footnotes).
// Keep this module dependency-free; the scraper's heavy imports (fflate,
// supabase-js) must not leak into client bundles.
//
// CPUC filing deadlines under the calendar-quarter schedule effective 2025:
// Q1 due May 1, Q2 due Aug 1, Q3 due Nov 1, Q4 due Feb 1 of the next year.

export interface Quarter {
  year: number;
  q: 1 | 2 | 3 | 4;
}

export const CPUC_PAGE_URL =
  "https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting";

// First quarter published under the stable zip naming pattern.
export const PATTERN_START: Quarter = { year: 2025, q: 2 };

// Days past the filing deadline before a missing quarter escalates to WARN.
export const OVERDUE_GRACE_DAYS = 42;

export function quarterLabel(qt: Quarter): string {
  return `Q${qt.q} ${qt.year}`;
}

// Parses "Q1 2026" back into a Quarter; returns null on unrecognized input.
export function parseQuarterLabel(label: string): Quarter | null {
  const m = label.match(/^Q([1-4])\s+(\d{4})$/);
  if (!m) return null;
  return { year: parseInt(m[2], 10), q: parseInt(m[1], 10) as 1 | 2 | 3 | 4 };
}

export function nextQuarter(qt: Quarter): Quarter {
  return qt.q === 4
    ? { year: qt.year + 1, q: 1 }
    : { year: qt.year, q: (qt.q + 1) as 1 | 2 | 3 | 4 };
}

export function quarterDateRange(qt: Quarter): {
  period_start: string;
  period_end: string;
} {
  const startMonth = (qt.q - 1) * 3;
  const start = new Date(Date.UTC(qt.year, startMonth, 1));
  const end = new Date(Date.UTC(qt.year, startMonth + 3, 0));
  return {
    period_start: start.toISOString().split("T")[0],
    period_end: end.toISOString().split("T")[0],
  };
}

export function filingDeadline(qt: Quarter): Date {
  const monthByQ: Record<number, [number, number]> = {
    1: [qt.year, 4], // May 1
    2: [qt.year, 7], // Aug 1
    3: [qt.year, 10], // Nov 1
    4: [qt.year + 1, 1], // Feb 1 next year
  };
  const [y, m] = monthByQ[qt.q];
  return new Date(Date.UTC(y, m, 1));
}

export function filingDeadlineLabel(qt: Quarter): string {
  return filingDeadline(qt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isOverdue(qt: Quarter, now: Date): boolean {
  const graceEnd = new Date(
    filingDeadline(qt).getTime() + OVERDUE_GRACE_DAYS * 24 * 60 * 60 * 1000
  );
  return now > graceEnd;
}

// All quarters from PATTERN_START whose filing deadline has passed as of now.
export function expectedQuarters(now: Date): Quarter[] {
  const out: Quarter[] = [];
  let cur: Quarter = { ...PATTERN_START };
  while (filingDeadline(cur) <= now) {
    out.push({ ...cur });
    cur = nextQuarter(cur);
  }
  return out;
}
