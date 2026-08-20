// components/earnings/MentionQuote.tsx
//
// One approved quote (module 4.6a). Server component: nothing here is
// interactive, and keeping it off the client means the timeline stays a
// static payload.
//
// Every quote rendered here was verified verbatim against the stored source
// before it was written (4.4) and approved by a human (4.5). The card says so
// implicitly by showing the speaker and the locator: the reader can check.

import { mentionTypeLabel, metricLabel, formatMetricValue } from "@/lib/earnings-mentions";
import type { PublicMention } from "@/lib/earnings-types";

interface MentionQuoteProps {
  mention: PublicMention;
  // The timeline shows a tighter version; the permalink shows everything.
  compact?: boolean;
}

export function MentionQuote({ mention, compact = false }: MentionQuoteProps) {
  const hasMetric = mention.metricSlug !== null && mention.metricValue !== null;

  return (
    <figure className="border-l-2 border-border pl-4 sm:pl-5">
      <blockquote
        className={`font-serif text-foreground ${
          compact ? "text-[1.0625rem] leading-[1.6]" : "text-[1.25rem] sm:text-[1.375rem] leading-[1.55]"
        }`}
      >
        &ldquo;{mention.quoteText}&rdquo;
      </blockquote>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        {mention.speaker && <cite className="not-italic font-medium text-foreground">{mention.speaker}</cite>}
        <span className="rounded-full border border-border px-2 py-0.5">
          {mentionTypeLabel(mention.mentionType)}
        </span>
        {hasMetric && (
          <span
            className={
              mention.promoted
                ? "rounded-full border border-accent px-2 py-0.5 text-accent"
                : "rounded-full border border-border px-2 py-0.5"
            }
            title={
              mention.promoted
                ? "This figure is published as a disclosed metric and drives the charts on this site."
                : "A figure was read from this quote but is not published as a disclosed metric."
            }
          >
            {formatMetricValue(mention.metricValue!, mention.metricUnit, mention.metricSlug)}{" "}
            {metricLabel(mention.metricSlug!)}
            {mention.promoted ? " (published)" : ""}
          </span>
        )}
        {!compact && mention.locator && <span className="tabular-nums opacity-70">{mention.locator}</span>}
      </figcaption>

      {mention.annotation && (
        <p className={`mt-3 border-l-2 border-accent pl-4 text-sm italic text-muted ${compact ? "hidden sm:block" : ""}`}>
          {mention.annotation}
        </p>
      )}
    </figure>
  );
}
