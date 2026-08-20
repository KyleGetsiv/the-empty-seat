// lib/earnings-slug.ts
//
// Client-safe. Keys derived from an earnings event's own columns: the
// permalink slug and the fiscal-period group key the timeline renders under.
// No supabase, no zod, no process.env, so 4.6b's client-side filter and the
// server data layer can both import it.
//
// Module 4.6a decision: permalinks carry no slug column and no migration.
// The slug is generated from (company slug, fiscal_period, event_type) and
// resolved by generating slugs for every event and matching, never by parsing
// the slug string back into parts. Parsing is ambiguous: company slugs
// contain hyphens ('pony-ai'), event types contain hyphens ('10-k',
// 'earnings-call'), and a slugified period does too ('q1-2026'), so
// 'pony-ai-q1-2026-earnings-call' has no unique split. Generating and
// comparing sidesteps that and detects collisions for free.

import type { SluggableEventFields } from "@/lib/earnings-types";

// The three columns a slug is built from. Owned by earnings-types.ts so the
// public event shape and this module cannot drift apart.
export type SluggableEvent = SluggableEventFields;

export function slugifyPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 'alphabet' + 'Q1 2026' + 'earnings_call' -> 'alphabet-q1-2026-earnings-call'
// 'alphabet' + 'FY 2025' + '10-K'          -> 'alphabet-fy-2025-10-k'
export function eventSlug(event: SluggableEvent): string {
  return [event.companySlug, event.fiscalPeriod, event.eventType]
    .map(slugifyPart)
    .filter(Boolean)
    .join("-");
}

export interface SlugMatch<T> {
  match: T | null;
  collisions: T[];
}

// Resolves a slug against a list of events. `collisions` holds every event
// sharing the slug when more than one does; the caller decides whether that
// is a 404 or a logged anomaly. Alphabet files one 8-K and one periodic
// report per quarter, so nothing collides today, but an amended 10-K/A or a
// second item-2.02 8-K in one quarter would, and .single() would throw a 500
// rather than degrade.
export function findBySlug<T extends SluggableEvent>(events: T[], slug: string): SlugMatch<T> {
  const hits = events.filter((e) => eventSlug(e) === slug);
  if (hits.length === 0) return { match: null, collisions: [] };
  if (hits.length === 1) return { match: hits[0], collisions: [] };
  return { match: null, collisions: hits };
}

// --- fiscal period grouping -------------------------------------------------
//
// The timeline groups by reporting moment, not by the literal fiscal_period
// string. A 10-K is filed as 'FY 2025' but reports the fourth quarter
// alongside the full year, and it lands days after the 'Q4 2025' 8-K and
// call. Grouping it under Q4 keeps one quarter's documents together; each
// card still shows its own fiscal_period, so nothing is relabeled.

const QUARTER_RE = /^Q([1-4])\s+(\d{4})$/i;
const FY_RE = /^FY\s+(\d{4})$/i;

export function periodGroupKey(fiscalPeriod: string): string {
  const fy = FY_RE.exec(fiscalPeriod.trim());
  if (fy) return `Q4 ${fy[1]}`;
  const q = QUARTER_RE.exec(fiscalPeriod.trim());
  if (q) return `Q${q[1]} ${q[2]}`;
  return fiscalPeriod.trim();
}

// Sortable integer, descending gives newest first. Unrecognized labels sort
// last rather than throwing, so an investor-day event with a free-text period
// never breaks the page.
export function periodSortValue(fiscalPeriod: string): number {
  const key = periodGroupKey(fiscalPeriod);
  const q = QUARTER_RE.exec(key);
  if (!q) return -1;
  return Number(q[2]) * 10 + Number(q[1]);
}

export function isFullYearPeriod(fiscalPeriod: string): boolean {
  return FY_RE.test(fiscalPeriod.trim());
}

// A group holding a 10-K says so, because the annual report is a different
// document from the quarterly ones filed beside it.
export function periodGroupLabel(groupKey: string, periodsInGroup: string[]): string {
  return periodsInGroup.some(isFullYearPeriod) ? `${groupKey} and full year` : groupKey;
}
