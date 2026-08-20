// lib/earnings-mentions.ts
//
// Client-safe vocabulary for the earnings review queue. No zod, no supabase,
// no process.env: the review queue's client components import from here, and
// lib/extraction/schema.ts builds its zod enums on top of the same lists so
// there is one source of truth for the mention vocabulary.

export const MENTION_TYPES = [
  "revenue_reference",
  "city_count",
  "ride_count",
  "fleet_size",
  "capex",
  "operating_loss",
  "strategic_commentary",
  "forward_guidance",
  "competitive_reference",
  "safety_reference",
  "other",
] as const;
export type MentionType = (typeof MENTION_TYPES)[number];

// Mention types that promote to a disclosed_metrics row on approval, and the
// disclosed_metrics.metric slug each maps to. A mention of one of these types
// with no number attached cannot promote, which is what the needs-a-number
// prompt in the review queue is for.
export const METRIC_PROMOTION: Record<string, string> = {
  ride_count: "weekly_rides",
  city_count: "cities_count",
  fleet_size: "fleet_size",
};

// --- promotion slug resolution (4.12) --------------------------------------
//
// The disclosed_metrics slugs a mention may promote to. Note what is absent:
// revenue_usd, operating_loss_usd and capex_usd are valid extraction slugs
// but have no disclosed_metrics home until the Other Bets walk (4.8), so a
// mention carrying one promotes NOTHING rather than falling through.
export const PROMOTABLE_METRICS = [
  "weekly_rides",
  "cumulative_trips",
  "fleet_size",
  "cities_count",
] as const;

export function isPromotableMetric(slug: string): boolean {
  return (PROMOTABLE_METRICS as readonly string[]).includes(slug);
}

// Which disclosed_metrics slug an approved mention publishes as.
//
// The model's own reading wins. `mention_type` is only a fallback for when
// the model named no quantity, because that type is too coarse to decide
// with: `ride_count` covers both "more than 400,000 rides every week" and
// "more than 4 million passenger trips to date", and METRIC_PROMOTION forced
// the weekly reading on both. That single ambiguity produced both bad rows
// fix(4.5) corrected, and in both cases the model had already read
// `cumulative_trips` correctly; only the map overrode it.
//
// A model slug that is valid but not promotable returns null rather than
// falling back. Falling back would file a revenue figure as weekly rides,
// which is the original bug wearing a different hat.
export function resolvePromotionSlug(
  metricSlug: string | null | undefined,
  mentionType: string
): string | null {
  if (metricSlug && metricSlug !== "other") {
    return isPromotableMetric(metricSlug) ? metricSlug : null;
  }
  return METRIC_PROMOTION[mentionType] ?? null;
}

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const EVENT_TYPES = [
  "10-K",
  "10-Q",
  "8-K",
  "earnings_call",
  "shareholder_letter",
  "investor_day",
  "press_release",
] as const;

export const PROCESSING_STATUSES = ["pending", "extracted", "reviewed", "failed"] as const;

export function isMetricType(mentionType: string): boolean {
  return Boolean(METRIC_PROMOTION[mentionType]);
}

// --- display vocabulary (4.6a) ---------------------------------------------
//
// Labels for the public earnings pages. They live here rather than in the
// page files so the timeline, the permalink, and 4.6b's client-side filter
// all read one list, and so a new mention_type cannot ship with a label on
// one surface and a raw slug on another.

export const EVENT_TYPE_LABELS: Record<string, string> = {
  "10-K": "Annual report (10-K)",
  "10-Q": "Quarterly report (10-Q)",
  "8-K": "Earnings release (8-K)",
  earnings_call: "Earnings call",
  shareholder_letter: "Shareholder letter",
  investor_day: "Investor day",
  press_release: "Press release",
};

// The short form, for chips and page titles where the parenthetical is noise.
export const EVENT_TYPE_SHORT: Record<string, string> = {
  "10-K": "10-K",
  "10-Q": "10-Q",
  "8-K": "8-K",
  earnings_call: "Earnings call",
  shareholder_letter: "Shareholder letter",
  investor_day: "Investor day",
  press_release: "Press release",
};

export const MENTION_TYPE_LABELS: Record<string, string> = {
  revenue_reference: "Revenue",
  city_count: "Cities",
  ride_count: "Rides",
  fleet_size: "Fleet",
  capex: "Capex",
  operating_loss: "Operating loss",
  strategic_commentary: "Strategy",
  forward_guidance: "Guidance",
  competitive_reference: "Competition",
  safety_reference: "Safety",
  other: "Other",
};

// Every slug in METRIC_SLUGS (lib/extraction/schema.ts). The first four
// promote to disclosed_metrics; the financial ones feed the Other Bets walk
// (4.8). Without an entry here the fallback renders the raw slug, which is
// how "operating loss usd" reached the browser in 4.6a.
export const METRIC_LABELS: Record<string, string> = {
  weekly_rides: "weekly rides",
  cumulative_trips: "cumulative trips",
  fleet_size: "fleet size",
  cities_count: "cities",
  revenue_usd: "revenue",
  operating_loss_usd: "operating loss",
  capex_usd: "capital expenditure",
  other: "figure",
};

export function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

export function eventTypeShort(eventType: string): string {
  return EVENT_TYPE_SHORT[eventType] ?? eventType;
}

export function mentionTypeLabel(mentionType: string): string {
  return MENTION_TYPE_LABELS[mentionType] ?? mentionType;
}

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replace(/_/g, " ");
}

// Event dates are stored as a plain date, so they are formatted in UTC. Doing
// it in local time renders "April 28" for a filing dated the 29th to anyone
// west of Greenwich, which is the kind of quiet inaccuracy this site exists
// to avoid.
export function formatEventDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatEventDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Metric values are stored in base units. Grouping separators and a currency
// symbol only; never rounded to "$382M", because the disclosed figure is the
// fact and the rounding would be ours. Dollar figures drop the redundant
// "USD" that otherwise reads as "$382,000,000 USD revenue usd".
export function formatMetricValue(
  value: number,
  unit?: string | null,
  metricSlug?: string | null
): string {
  const n = value.toLocaleString("en-US");
  const isUsd = /^usd$/i.test(unit ?? "") || Boolean(metricSlug?.endsWith("_usd"));
  if (isUsd) return `$${n}`;
  return unit ? `${n} ${unit}` : n;
}
