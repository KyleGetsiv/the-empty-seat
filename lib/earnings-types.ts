// lib/earnings-types.ts
//
// Client-safe view types for the public earnings pages (module 4.6a),
// following the lib/landscape.ts + lib/landscape-types.ts split: the server
// queries live in lib/earnings-public.ts, the shapes and pure helpers live
// here so client components (and 4.6b's search filter) can import them
// without dragging in supabase.

export interface PublicMention {
  id: string;
  mentionType: string;
  quoteText: string;
  speaker: string | null;
  confidence: string;
  annotation: string | null;
  metricSlug: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  metricPeriod: string | null;
  promoted: boolean;
  locator: string | null;
}

// Why an event shows no quotes. These are four different facts and the
// timeline says which one applies. Collapsing them was the hole found at
// 4.6a planning: RLS exposes every earnings_events row to anon regardless of
// processing_status, and the daily EDGAR action means an unreviewed filing
// exists most weeks. Rendering that as "no Waymo mentions" would state that
// Alphabet said nothing when the truth is that nobody has looked yet, which
// is the same quiet-failure-as-success pattern the CPUC scraper was fixed for.
export type EventPresence =
  | "has_mentions"
  | "awaiting_review"
  | "no_relevant_passages"
  | "no_approved_mentions";

export interface SluggableEventFields {
  companySlug: string;
  fiscalPeriod: string;
  eventType: string;
}

export interface PublicEarningsEvent extends SluggableEventFields {
  id: string;
  slug: string;
  filerName: string;
  subjectName: string;
  eventDate: string;
  processingStatus: string;
  reviewComplete: boolean;
  extractionChunks: number | null;
  extractionModel: string | null;
  extractionVersion: number | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourcePublisher: string | null;
  mentions: PublicMention[];
  presence: EventPresence;
}

export function presenceFor(
  processingStatus: string,
  extractionChunks: number | null,
  approvedCount: number
): EventPresence {
  if (approvedCount > 0) return "has_mentions";
  if (processingStatus === "pending" || processingStatus === "failed") return "awaiting_review";
  if (extractionChunks === 0) return "no_relevant_passages";
  return "no_approved_mentions";
}

// The line the timeline and the permalink both show when there is nothing to
// quote. Written as sentences rather than labels because each one is a
// different claim about the document, and the difference is the point.
export const PRESENCE_COPY: Record<Exclude<EventPresence, "has_mentions">, string> = {
  awaiting_review:
    "Ingested, not yet reviewed. Nothing from this document is published until a human has checked it.",
  no_relevant_passages: "This document contains no passage mentioning Waymo or Other Bets.",
  // Deliberately does not say "nothing survived review". That would claim
  // statements were extracted and then rejected, and this page cannot tell
  // that apart from nothing having been extracted at all: earnings_events
  // records extraction_chunks and mentions_dropped but no extracted total,
  // and RLS shows anon approved mentions only. Adding a mentions_extracted
  // column would let the two be distinguished honestly; until then the
  // wording has to be true in both cases.
  no_approved_mentions: "Reviewed. Nothing from this document is published.",
};
