// lib/earnings-public.ts
//
// Server-side reads behind the public /earnings routes (module 4.6a).
// Never imported by a "use client" file: the client components read their
// vocabulary from lib/earnings-mentions.ts and lib/earnings-slug.ts.
//
// Two guards, deliberately redundant, because the credibility of this page
// rests on exactly one property: nothing the model produced is public until a
// human approved it.
//   1. The cookieless anon client (lib/supabase/public.ts), so RLS evaluates
//      as anon even when an admin is the one browsing.
//   2. An explicit review_status filter on every mention read.
// Either alone is sufficient. Keeping both means a later refactor has to
// remove two things, not one, to leak unreviewed LLM output.

import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { eventSlug, findBySlug, type SluggableEvent } from "@/lib/earnings-slug";
import {
  presenceFor,
  type PublicMention,
  type PublicEarningsEvent,
} from "@/lib/earnings-types";

export type {
  PublicMention,
  PublicEarningsEvent,
  EventPresence,
} from "@/lib/earnings-types";

type CompanyJoin = { slug: string; display_name: string } | null;
type SourceJoin = { url: string; title: string | null; publisher: string | null } | null;
type MetricJson = { metric?: string; value?: number; unit?: string; period?: string } | null;

const EVENT_COLUMNS = `
  id, fiscal_period, event_type, event_date, processing_status,
  extraction_chunks, extraction_model, extraction_version,
  filer:companies!earnings_events_company_id_fkey(slug, display_name),
  subject:companies!earnings_events_subject_company_id_fkey(slug, display_name),
  source:sources(url, title, publisher)
`;

function toMention(row: Record<string, unknown>): PublicMention {
  const em = (row.extracted_metric ?? null) as MetricJson;
  return {
    id: row.id as string,
    mentionType: row.mention_type as string,
    quoteText: row.quote_text as string,
    speaker: (row.speaker as string | null) ?? null,
    confidence: row.confidence as string,
    annotation: (row.kyle_annotation as string | null) ?? null,
    metricSlug: em?.metric ?? null,
    metricValue: typeof em?.value === "number" ? em.value : null,
    metricUnit: em?.unit ?? null,
    metricPeriod: em?.period ?? null,
    promoted: Boolean(row.disclosed_metric_id),
    locator: (row.page_or_timestamp as string | null) ?? null,
  };
}

function toEvent(row: Record<string, unknown>, mentions: PublicMention[]): PublicEarningsEvent {
  const filer = (row.filer ?? null) as CompanyJoin;
  const subject = (row.subject ?? null) as CompanyJoin;
  const source = (row.source ?? null) as SourceJoin;
  const companySlug = filer?.slug ?? "unknown";
  const fiscalPeriod = row.fiscal_period as string;
  const eventType = row.event_type as string;
  const processingStatus = row.processing_status as string;
  const extractionChunks = (row.extraction_chunks as number | null) ?? null;

  return {
    id: row.id as string,
    companySlug,
    fiscalPeriod,
    eventType,
    slug: eventSlug({ companySlug, fiscalPeriod, eventType }),
    filerName: filer?.display_name ?? "Unknown filer",
    subjectName: subject?.display_name ?? "Waymo",
    eventDate: row.event_date as string,
    processingStatus,
    reviewComplete: processingStatus === "reviewed",
    extractionChunks,
    extractionModel: (row.extraction_model as string | null) ?? null,
    extractionVersion: (row.extraction_version as number | null) ?? null,
    sourceUrl: source?.url ?? null,
    sourceTitle: source?.title ?? null,
    sourcePublisher: source?.publisher ?? null,
    mentions,
    presence: presenceFor(processingStatus, extractionChunks, mentions.length),
  };
}

// The whole corpus in two queries. At 33 events and 162 approved mentions
// that is one small ISR payload, which is also what makes 4.6b's search a
// client-side filter rather than a tsvector index. Revisit past a few
// thousand mentions.
export const getEarningsTimeline = cache(async (): Promise<PublicEarningsEvent[]> => {
  const supabase = createSupabasePublicClient();

  const [{ data: events, error: eventsError }, { data: mentions, error: mentionsError }] =
    await Promise.all([
      supabase.from("earnings_events").select(EVENT_COLUMNS).order("event_date", { ascending: false }),
      supabase
        .from("waymo_mentions")
        .select(
          "id, earnings_event_id, mention_type, quote_text, speaker, confidence, kyle_annotation, extracted_metric, disclosed_metric_id, page_or_timestamp, created_at"
        )
        .eq("review_status", "approved")
        .order("created_at", { ascending: true }),
    ]);

  if (eventsError) {
    console.error("[earnings-public] events", eventsError);
    throw new Error(`Failed to read earnings_events: ${eventsError.message}`);
  }
  if (mentionsError) {
    console.error("[earnings-public] mentions", mentionsError);
    throw new Error(`Failed to read waymo_mentions: ${mentionsError.message}`);
  }

  const byEvent = new Map<string, PublicMention[]>();
  for (const row of mentions ?? []) {
    const key = (row as Record<string, unknown>).earnings_event_id as string;
    const list = byEvent.get(key) ?? [];
    list.push(toMention(row as Record<string, unknown>));
    byEvent.set(key, list);
  }

  return (events ?? []).map((row) =>
    toEvent(row as Record<string, unknown>, byEvent.get((row as Record<string, unknown>).id as string) ?? [])
  );
});

export interface EventIndexEntry extends SluggableEvent {
  id: string;
  slug: string;
}

// Slug index for generateStaticParams and for slug resolution. Deliberately
// the cheapest possible query: four columns over every event.
export const getEarningsEventIndex = cache(async (): Promise<EventIndexEntry[]> => {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("earnings_events")
    .select("id, fiscal_period, event_type, filer:companies!earnings_events_company_id_fkey(slug)")
    .order("event_date", { ascending: false });

  if (error) {
    console.error("[earnings-public] index", error);
    throw new Error(`Failed to read the earnings event index: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const filer = (r.filer ?? null) as { slug: string } | null;
    const entry: SluggableEvent = {
      companySlug: filer?.slug ?? "unknown",
      fiscalPeriod: r.fiscal_period as string,
      eventType: r.event_type as string,
    };
    return { id: r.id as string, slug: eventSlug(entry), ...entry };
  });
});

export const getEarningsEventById = cache(async (id: string): Promise<PublicEarningsEvent | null> => {
  const supabase = createSupabasePublicClient();

  const [{ data: event, error: eventError }, { data: mentions, error: mentionsError }] =
    await Promise.all([
      supabase.from("earnings_events").select(EVENT_COLUMNS).eq("id", id).maybeSingle(),
      supabase
        .from("waymo_mentions")
        .select(
          "id, mention_type, quote_text, speaker, confidence, kyle_annotation, extracted_metric, disclosed_metric_id, page_or_timestamp, created_at"
        )
        .eq("earnings_event_id", id)
        .eq("review_status", "approved")
        .order("created_at", { ascending: true }),
    ]);

  if (eventError) {
    console.error("[earnings-public] event", eventError);
    throw new Error(`Failed to read earnings_events row: ${eventError.message}`);
  }
  if (mentionsError) {
    console.error("[earnings-public] event mentions", mentionsError);
    throw new Error(`Failed to read waymo_mentions: ${mentionsError.message}`);
  }
  if (!event) return null;

  return toEvent(
    event as Record<string, unknown>,
    (mentions ?? []).map((m) => toMention(m as Record<string, unknown>))
  );
});

// Resolves a permalink. Matching is done by generating slugs, not by parsing
// the slug string (see lib/earnings-slug.ts for why), and it matches on the
// filer as well as the period and type, so adding a second filer to
// EDGAR_FILERS cannot start returning whichever row came back first. A
// genuine collision returns null and logs, so the page 404s rather than
// serving one of two documents at random or throwing a 500 from .single().
export const getEarningsEventBySlug = cache(async (slug: string): Promise<PublicEarningsEvent | null> => {
  const index = await getEarningsEventIndex();
  const { match, collisions } = findBySlug(index, slug);

  if (collisions.length > 0) {
    console.error(
      `[earnings-public] slug "${slug}" matches ${collisions.length} events (${collisions
        .map((c) => c.id)
        .join(", ")}). (fiscal_period, event_type) is no longer unique per filer; permalinks need a discriminator.`
    );
    return null;
  }
  if (!match) return null;

  return getEarningsEventById(match.id);
});

// Corpus-level figures for the provenance strip. Derived, never hardcoded.
export interface EarningsCorpusStats {
  documents: number;
  documentsWithMentions: number;
  approvedMentions: number;
  promotedMetrics: number;
  awaitingReview: number;
  earliestDate: string | null;
  latestDate: string | null;
  models: string[];
}

export function summarizeCorpus(events: PublicEarningsEvent[]): EarningsCorpusStats {
  const dates = events.map((e) => e.eventDate).sort();
  return {
    documents: events.length,
    documentsWithMentions: events.filter((e) => e.mentions.length > 0).length,
    approvedMentions: events.reduce((n, e) => n + e.mentions.length, 0),
    promotedMetrics: events.reduce((n, e) => n + e.mentions.filter((m) => m.promoted).length, 0),
    awaitingReview: events.filter((e) => e.presence === "awaiting_review").length,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    models: [...new Set(events.map((e) => e.extractionModel).filter((m): m is string => Boolean(m)))].sort(),
  };
}
