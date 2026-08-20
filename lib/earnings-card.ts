// lib/earnings-card.ts
//
// Client-safe. Chooses what goes in a social card's headline slot (4.6b).
//
// Extracted from the route so it can be tested without importing next/og.
// The rule worth testing is what it refuses: a table-derived mention's
// quote_text carries the scaffolding annotateTableRows added, so putting it
// on a card would ship "[Three Months Ended Six Months Ended | Revenues:]
// Other Bets 373 382" as something Alphabet said, to the audience least able
// to check it. That is the 4.6a bug with a wider blast radius, because a card
// travels into other people's feeds without the page around it.

import { isTableReading } from "@/lib/earnings-table";
import { formatMetricValue, metricLabel } from "@/lib/earnings-mentions";
import { PRESENCE_COPY, type PublicEarningsEvent } from "@/lib/earnings-types";

export type HeadlineKind = "quote" | "figure" | "silent";

export interface CardHeadline {
  text: string;
  kind: HeadlineKind;
}

export const HEADLINE_MAX_CHARS = 240;

export function truncateForCard(text: string, max = HEADLINE_MAX_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

// Prose first, then a figure rendered as a figure, then the honest silence.
export function cardHeadline(event: PublicEarningsEvent): CardHeadline {
  const prose = event.mentions.find((m) => !isTableReading(m.quoteText));
  if (prose) return { text: truncateForCard(prose.quoteText), kind: "quote" };

  const figure = event.mentions.find((m) => m.metricSlug && m.metricValue !== null);
  if (figure) {
    return {
      text: `${formatMetricValue(figure.metricValue!, figure.metricUnit, figure.metricSlug)} ${metricLabel(
        figure.metricSlug!
      )}`,
      kind: "figure",
    };
  }

  if (event.presence !== "has_mentions") {
    return { text: PRESENCE_COPY[event.presence], kind: "silent" };
  }
  return { text: `What Alphabet said about ${event.subjectName}`, kind: "silent" };
}
