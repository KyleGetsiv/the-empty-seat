// components/earnings/EventCard.tsx
//
// One source document on the /earnings timeline (module 4.6a). Server
// component, shared with the permalink page for its header.
//
// An event with nothing to quote still renders. A quarter in which Alphabet
// said nothing about Waymo is a finding, and showing every ingested document
// is what proves the pipeline is not selecting the flattering ones. The four
// reasons a document can be silent are kept distinct (see PRESENCE_COPY):
// "nobody has reviewed this yet" is not the same claim as "this document
// does not mention Waymo".

import Link from "next/link";
import { Mention } from "./Mention";
import { eventTypeShort, formatEventDateShort } from "@/lib/earnings-mentions";
import { describeMentionMix } from "@/lib/earnings-table";
import { PRESENCE_COPY, type PublicEarningsEvent } from "@/lib/earnings-types";

const PREVIEW_LIMIT = 2;

export function EventCard({ event }: { event: PublicEarningsEvent }) {
  // Narrowed inline rather than through a boolean, so PRESENCE_COPY (which is
  // keyed on the silent cases only) indexes without a cast.
  if (event.presence !== "has_mentions") {
    return (
      <article className="flex flex-col gap-1 border-t border-border py-4 sm:flex-row sm:items-baseline sm:gap-4">
        <div className="flex shrink-0 items-baseline gap-3 text-xs text-muted sm:w-56">
          <span className="font-medium text-muted">{eventTypeShort(event.eventType)}</span>
          <time dateTime={event.eventDate} className="tabular-nums">
            {formatEventDateShort(event.eventDate)}
          </time>
        </div>
        <p className="flex-1 text-sm text-muted">
          {PRESENCE_COPY[event.presence]}{" "}
          <Link
            href={`/earnings/${event.slug}`}
            className="underline decoration-border underline-offset-2 hover:text-foreground transition-colors"
          >
            Details
          </Link>
        </p>
      </article>
    );
  }

  const shown = event.mentions.slice(0, PREVIEW_LIMIT);
  const remaining = event.mentions.length - shown.length;

  return (
    <article className="border-t border-border py-8">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="font-serif text-lg text-foreground">
          <Link href={`/earnings/${event.slug}`} className="hover:text-accent transition-colors">
            {event.fiscalPeriod} {eventTypeShort(event.eventType)}
          </Link>
        </h3>
        <time dateTime={event.eventDate} className="text-xs text-muted tabular-nums">
          {formatEventDateShort(event.eventDate)}
        </time>
        <span className="text-xs text-muted">{describeMentionMix(event.mentions)} approved</span>
        {!event.reviewComplete && (
          <span
            className="text-xs text-muted opacity-80"
            title="Some statements from this document are still in the review queue."
          >
            review in progress
          </span>
        )}
      </header>

      <div className="mt-6 flex flex-col gap-6">
        {shown.map((m) => (
          <Mention key={m.id} mention={m} compact />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <Link
          href={`/earnings/${event.slug}`}
          className="text-accent underline hover:text-accent-hover transition-colors"
        >
          {remaining > 0
            ? `See all ${describeMentionMix(event.mentions)}`
            : "Permalink and extraction detail"}
        </Link>
        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted underline decoration-border underline-offset-2 hover:text-foreground transition-colors"
          >
            Primary source
            {event.sourcePublisher ? ` (${event.sourcePublisher})` : ""}
          </a>
        )}
      </div>
    </article>
  );
}
