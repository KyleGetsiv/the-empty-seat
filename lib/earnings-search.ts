// lib/earnings-search.ts
//
// Client-safe. The text each mention is filtered against, and the filter
// itself (module 4.6b).
//
// The point of this module is what it REFUSES to index. After the 4.6a fix,
// a table-derived mention's quote_text reads
//     [Three Months Ended Six Months Ended | Revenues:] Other Bets 373 382 ...
// The header words are the filing's own, but the brackets, the pipe, and the
// adjacency between "Ended" and "Revenues" are ours: annotateTableRows put
// them there. Indexing that string would let a phrase search match text no
// human ever composed, on a feature whose whole promise is the word verbatim.
//
// So the haystack is built from PRESENTED parts, never from raw quote_text,
// for anything that parses as a table row. The synthetic punctuation is not
// dropped by a cleanup pass, it is never introduced.

import { parseTableReading } from "@/lib/earnings-table";
import { mentionTypeLabel, metricLabel, eventTypeShort } from "@/lib/earnings-mentions";
import type { PublicMention, PublicEarningsEvent } from "@/lib/earnings-types";

// Curly quotes and dashes are normalized so a reader typing an apostrophe
// matches a filing that used a typographic one. Same reasoning as
// verifyQuote's normalizeForMatch in lib/extraction/text.ts, though this one
// is far looser: it is a filter, not a verification.
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// What a single mention can be found by. For prose this is the quote as
// stored. For a table row it is the document's own labels and cells, joined
// with spaces, so nothing spans a boundary the filing does not contain.
export function mentionHaystack(mention: PublicMention): string {
  const reading = parseTableReading(mention.quoteText);

  const parts: string[] = reading
    ? [reading.section ?? "", reading.rowLabel, reading.values.join(" "), reading.columns]
    : [mention.quoteText];

  parts.push(mention.speaker ?? "");
  parts.push(mentionTypeLabel(mention.mentionType));
  if (mention.metricSlug) parts.push(metricLabel(mention.metricSlug));
  if (mention.metricPeriod) parts.push(mention.metricPeriod);
  parts.push(mention.annotation ?? "");

  return normalizeForSearch(parts.filter(Boolean).join(" "));
}

// An event is findable by its own identity too, so "10-K" or "Q1 2026"
// narrows the timeline even when no quote contains those characters.
export function eventHaystack(event: PublicEarningsEvent): string {
  return normalizeForSearch(
    [
      event.fiscalPeriod,
      eventTypeShort(event.eventType),
      event.eventType,
      event.filerName,
      event.subjectName,
      event.eventDate,
      event.sourcePublisher ?? "",
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export interface SearchableEvent {
  event: PublicEarningsEvent;
  eventText: string;
  mentionText: Map<string, string>;
}

// Built once from the server payload, reused on every keystroke.
export function buildSearchIndex(events: PublicEarningsEvent[]): SearchableEvent[] {
  return events.map((event) => ({
    event,
    eventText: eventHaystack(event),
    mentionText: new Map(event.mentions.map((m) => [m.id, mentionHaystack(m)])),
  }));
}

export interface FilterResult {
  events: PublicEarningsEvent[];
  matchedMentions: number;
  // True when the query is empty, so callers can skip the filtered rendering
  // path entirely and show the unfiltered timeline.
  unfiltered: boolean;
}

// Substring match, not tokenized and not ranked. A quoted phrase behaves the
// way a reader expects because the haystack preserves word order within each
// part. An event matching on its own identity keeps all of its mentions; an
// event matching only on quote text is narrowed to the matching quotes, so
// the reader sees why it matched.
export function filterEvents(index: SearchableEvent[], rawQuery: string): FilterResult {
  const q = normalizeForSearch(rawQuery);
  if (!q) {
    return {
      events: index.map((i) => i.event),
      matchedMentions: index.reduce((n, i) => n + i.event.mentions.length, 0),
      unfiltered: true,
    };
  }

  const events: PublicEarningsEvent[] = [];
  let matchedMentions = 0;

  for (const entry of index) {
    const eventMatches = entry.eventText.includes(q);
    const hits = entry.event.mentions.filter((m) => (entry.mentionText.get(m.id) ?? "").includes(q));

    if (eventMatches) {
      events.push(entry.event);
      matchedMentions += entry.event.mentions.length;
      continue;
    }
    if (hits.length > 0) {
      events.push({ ...entry.event, mentions: hits });
      matchedMentions += hits.length;
    }
  }

  return { events, matchedMentions, unfiltered: false };
}
