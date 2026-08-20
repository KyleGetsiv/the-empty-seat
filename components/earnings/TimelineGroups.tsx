// components/earnings/TimelineGroups.tsx
//
// The grouped timeline itself, with no interactivity (module 4.6b).
//
// Rendered twice: once by the server as the Suspense fallback, so the static
// HTML carries the whole record for a reader with no JavaScript and for a
// crawler, and once by the client filter with a narrowed event list. One
// component, so the filtered and unfiltered views cannot diverge.

import { EventCard } from "./EventCard";
import { groupEventsByPeriod } from "@/lib/earnings-slug";
import type { PublicEarningsEvent } from "@/lib/earnings-types";

export function TimelineGroups({ events }: { events: PublicEarningsEvent[] }) {
  const groups = groupEventsByPeriod(events);
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-16">
      {groups.map((group) => (
        <section
          key={group.key}
          id={group.key.toLowerCase().replace(/\s+/g, "-")}
          className="scroll-mt-20"
        >
          <h3 className="font-serif text-[1.75rem] sm:text-[2rem] leading-tight text-foreground">
            {group.label}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {group.events.length} {group.events.length === 1 ? "document" : "documents"}
          </p>
          <div className="mt-6">
            {group.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
