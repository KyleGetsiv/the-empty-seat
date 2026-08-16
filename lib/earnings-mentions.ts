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
