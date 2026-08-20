// components/earnings/TableReading.tsx
//
// A mention whose quote is a row from a financial table, rendered as a
// reading rather than a quotation (4.6a fix).
//
// Nobody uttered "Other Bets 373 382 823 793". It is four cells from a
// segment table, and the bracketed context in front of it was synthesized by
// the extraction parser, not written by Alphabet. Presenting that in a serif
// blockquote under "What Alphabet said" was a category error: it read as an
// illegible sentence when it is a perfectly legible number.
//
// So the interpreted figure leads, taken from extracted_metric (which the
// model got right), the document's own row and section labels identify it,
// and the raw row is demoted to a labelled audit line rather than deleted.
// Nothing is smoothed and nothing is hidden: a reader can still check the
// stored row against the filing.

import { parseTableReading, readingLabel } from "@/lib/earnings-table";
import { mentionTypeLabel, metricLabel, formatMetricValue } from "@/lib/earnings-mentions";
import type { PublicMention } from "@/lib/earnings-types";

interface TableReadingProps {
  mention: PublicMention;
  compact?: boolean;
}

export function TableReading({ mention, compact = false }: TableReadingProps) {
  const reading = parseTableReading(mention.quoteText);
  // Callers check isTableReading first; this is belt and braces so a parser
  // change degrades to nothing rather than throwing.
  if (!reading) return null;

  const label = readingLabel(reading) || reading.columns;
  const hasFigure = mention.metricSlug !== null && mention.metricValue !== null;

  return (
    <div className="border-l-2 border-border pl-4 sm:pl-5">
      <p className="text-xs uppercase tracking-wide text-muted">
        {mentionTypeLabel(mention.mentionType)}
        {mention.promoted && (
          <span className="ml-2 normal-case tracking-normal text-accent">published</span>
        )}
      </p>

      {hasFigure ? (
        <p className="mt-1.5 font-serif text-[1.5rem] sm:text-[1.75rem] leading-tight text-foreground tabular-nums">
          {formatMetricValue(mention.metricValue!, mention.metricUnit, mention.metricSlug)}
          {mention.metricSlug && mention.metricSlug !== "other" && (
            <span className="ml-2 font-sans text-base text-muted">
              {metricLabel(mention.metricSlug)}
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1.5 font-mono text-sm text-foreground tabular-nums">
          {reading.values.join("   ") || reading.rowLabel}
        </p>
      )}

      <p className="mt-1.5 text-sm text-muted">
        {label}
        {mention.metricPeriod && <span className="tabular-nums"> &middot; {mention.metricPeriod}</span>}
      </p>

      {!compact && (
        <div className="mt-3 text-xs text-muted">
          <p>
            Read from a table in this filing, not spoken. Columns as filed:{" "}
            <span className="text-foreground">{reading.columns}</span>.
          </p>
          <p className="mt-1 font-mono opacity-70 break-words">
            {reading.rowLabel}
            {reading.values.length > 0 ? `  ${reading.values.join("  ")}` : ""}
          </p>
        </div>
      )}

      {mention.annotation && (
        <p className="mt-3 border-l-2 border-accent pl-4 text-sm italic text-muted">
          {mention.annotation}
        </p>
      )}
    </div>
  );
}
