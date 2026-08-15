// lib/extraction/schema.ts
//
// The contract between the extraction model and the waymo_mentions table.
// The Zod schema is the single source of truth: it is converted to the JSON
// Schema handed to the model as a tool definition, and it validates what
// comes back before anything touches the database.
//
// EXTRACTION_VERSION is bumped whenever the prompt, schema, chunking, or
// verification rules change in a way that could alter output. Events carry
// the version they were processed with, so a future re-run can target only
// stale ones.

import { z } from "zod";

export const EXTRACTION_VERSION = 1;

// Model decision recorded in CLAUDE.md (Phase 4). Overridable per
// environment so a re-run can be pinned to a specific dated snapshot.
export const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL || "claude-sonnet-5";

// Estimated pricing per million tokens, used only for the Slack cost line.
// Real billing is what Anthropic charges; these are labelled "est." in
// every message that shows them.
export const PRICE_USD_PER_MTOK_IN = Number(process.env.EXTRACTION_PRICE_IN || 3);
export const PRICE_USD_PER_MTOK_OUT = Number(process.env.EXTRACTION_PRICE_OUT || 15);

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

// Metric slugs the model may attach to a mention. The first four are the
// disclosed_metrics slugs (the review queue promotes ride_count -> weekly_rides
// and so on); the financial ones feed the Other Bets walk (4.8).
export const METRIC_SLUGS = [
  "weekly_rides",
  "cumulative_trips",
  "fleet_size",
  "cities_count",
  "revenue_usd",
  "operating_loss_usd",
  "capex_usd",
  "other",
] as const;

export const ExtractedMetricSchema = z.object({
  metric: z.enum(METRIC_SLUGS).describe("Which quantity the number measures."),
  value: z
    .number()
    .describe(
      "The number as a plain numeric value in base units: rides per week as a count (250000 not 250K), dollars as dollars (1800000000 not 1.8B)."
    ),
  unit: z
    .string()
    .nullable()
    .describe("Unit as stated, e.g. 'paid rides per week', 'USD', 'cities', or null."),
  period: z
    .string()
    .nullable()
    .describe(
      "The period the figure applies to as stated in the text, e.g. 'Q1 2026', 'as of April 2026', 'full year 2025', or null if not stated."
    ),
  scope: z
    .enum(["waymo", "other_bets"])
    .describe(
      "'waymo' if the figure is explicitly about Waymo; 'other_bets' if it is an Other Bets segment figure (which contains Waymo but is not Waymo alone)."
    ),
});
export type ExtractedMetric = z.infer<typeof ExtractedMetricSchema>;

export const MentionSchema = z.object({
  locator: z
    .string()
    .describe("The bracketed passage id the quote comes from, exactly as labelled in the input, e.g. 't42' or 'p118'."),
  quote_text: z
    .string()
    .min(10)
    .describe(
      "A verbatim, contiguous excerpt from the labelled passage: the sentence or sentences that mention Waymo. Copy characters exactly; do not paraphrase, abbreviate, or stitch non-adjacent sentences together."
    ),
  speaker: z
    .string()
    .nullable()
    .describe("For call transcripts, the speaker's name as labelled on the passage. Null for filings and press releases."),
  mention_type: z.enum(MENTION_TYPES),
  extracted_metric: ExtractedMetricSchema.nullable().describe(
    "Populate only when the quote states a specific number for a Waymo or Other Bets quantity. Otherwise null."
  ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "high: the quote is unambiguously about Waymo and, if a metric is attached, the number and its meaning are explicit. medium: some interpretation was needed (e.g. 'the business' clearly refers back to Waymo). low: plausible but uncertain."
    ),
});
export type ExtractedMention = z.infer<typeof MentionSchema>;

export const ExtractionOutputSchema = z.object({
  mentions: z.array(MentionSchema).describe("Every qualifying passage in the input. Empty array if none qualify."),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

// JSON Schema for the tool definition. Zod 4 ships a converter; the model
// sees the same descriptions the validator enforces.
export function extractionToolInputSchema(): Record<string, unknown> {
  return z.toJSONSchema(ExtractionOutputSchema) as Record<string, unknown>;
}
