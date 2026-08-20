"use client";

// components/earnings/EarningsTimeline.tsx
//
// The filter over the record (module 4.6b).
//
// Client only so filtering runs without a round trip. The server already
// ships the whole corpus, which is what made a client filter the right call
// rather than a tsvector index: 33 events and 162 approved mentions travel
// with the page anyway. Revisit past a few thousand mentions.
//
// The query lives in ?q= so a filtered view is linkable. It is read through
// useSearchParams rather than an effect, which means this component must sit
// inside a Suspense boundary on a statically rendered route; the page renders
// the unfiltered TimelineGroups as the fallback, so the static HTML still
// carries the entire record for a reader without JavaScript.

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TimelineGroups } from "./TimelineGroups";
import { buildSearchIndex, filterEvents } from "@/lib/earnings-search";
import type { PublicEarningsEvent } from "@/lib/earnings-types";

const QUERY_PARAM = "q";

export function EarningsTimeline({ events }: { events: PublicEarningsEvent[] }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get(QUERY_PARAM) ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // replaceState rather than router.replace: this is view state, not a
  // navigation, and pushing it through the router would re-run the route on
  // every keystroke for a filter that is already entirely in memory.
  function updateQuery(next: string) {
    setQuery(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set(QUERY_PARAM, next);
    else url.searchParams.delete(QUERY_PARAM);
    window.history.replaceState(null, "", url.toString());
  }

  const index = useMemo(() => buildSearchIndex(events), [events]);
  const result = useMemo(() => filterEvents(index, query), [index, query]);
  const documentsWithMatches = result.events.filter((e) => e.mentions.length > 0).length;

  return (
    <>
      <div className="mb-12">
        <label htmlFor="earnings-filter" className="block text-xs uppercase tracking-wide text-muted">
          Filter the record
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            id="earnings-filter"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="A word, a name, a quarter"
            autoComplete="off"
            className="w-full max-w-md rounded border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                updateQuery("");
                inputRef.current?.focus();
              }}
              className="shrink-0 text-sm text-muted underline decoration-border underline-offset-2 hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {result.unfiltered ? (
            <>
              Matches text within approved statements, plus speaker names, document types and
              quarters. It searches what was published here, not the filings themselves.
            </>
          ) : result.events.length === 0 ? (
            <>
              Nothing matches <span className="text-foreground">{query}</span>. That is a fact about
              this corpus rather than about Alphabet: only statements approved for publication are
              searchable.
            </>
          ) : (
            <>
              <span className="text-foreground">{result.matchedMentions}</span>{" "}
              {result.matchedMentions === 1 ? "statement" : "statements"} across{" "}
              <span className="text-foreground">{documentsWithMatches}</span>{" "}
              {documentsWithMatches === 1 ? "document" : "documents"}.
            </>
          )}
        </p>
      </div>

      <TimelineGroups events={result.events} />
    </>
  );
}
