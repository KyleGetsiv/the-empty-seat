import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SpeakerTurn } from "@/lib/scrapers/transcripts";
import { STORAGE_BUCKET } from "@/lib/extraction/drop-log";
import {
  passagesFromHtml,
  passagesFromTurns,
  selectRelevantPassages,
  RELEVANCE_PATTERN,
  type Passage,
} from "@/lib/extraction/text";

// Reads the archived document behind an earnings event and renders it as the
// labelled passages the extraction pipeline saw, so a reviewer can click from
// a quote to the exact passage it came from (module 4.5).
//
// The stored document lives in a private Storage bucket, so there is nothing
// to link to directly: this route is the viewer. Passage ids are re-derived
// with the same pure functions the pipeline uses (lib/extraction/text.ts), so
// they match waymo_mentions.page_or_timestamp for any event extracted with
// the current parser. A future parser change can shift ids on old events;
// that is why the locator is shown as "as labelled at extraction time".
//
// Default view is the relevant passages (the ones the model was actually
// shown). ?full=1 renders the whole document, capped, for the times a quote
// needs its surroundings.

const FULL_VIEW_CAP = 4000;

async function loadPassages(storageKey: string): Promise<Passage[]> {
  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(storageKey);
  if (error || !data) throw new Error(error?.message ?? "no data");
  const text = await data.text();
  if (storageKey.endsWith(".json")) return passagesFromTurns(JSON.parse(text) as SpeakerTurn[]);
  return passagesFromHtml(text);
}

export default async function StoredSourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ p?: string; full?: string }>;
}) {
  const { id } = await params;
  const { p: cited = "", full = "" } = await searchParams;

  const { data: event } = await supabaseAdmin
    .from("earnings_events")
    .select("id, fiscal_period, event_type, event_date, storage_key, extraction_version, source:sources(url, title)")
    .eq("id", id)
    .single();
  if (!event) notFound();
  const src = event.source as unknown as { url: string; title: string } | null;

  const { data: mentionRows } = await supabaseAdmin
    .from("waymo_mentions")
    .select("page_or_timestamp, review_status")
    .eq("earnings_event_id", id);
  const quoted = new Map<string, string>();
  for (const m of mentionRows ?? []) {
    if (m.page_or_timestamp) quoted.set(m.page_or_timestamp, m.review_status);
  }

  let passages: Passage[] = [];
  let loadError: string | null = null;
  if (!event.storage_key) {
    loadError = "This event has no stored document.";
  } else {
    try {
      passages = await loadPassages(event.storage_key);
    } catch (err) {
      loadError = `Could not read ${event.storage_key} from Storage: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const isFull = full === "1";
  const shown = isFull ? passages.slice(0, FULL_VIEW_CAP) : selectRelevantPassages(passages);
  // A cited passage outside the current view would make the link land nowhere,
  // which is worse than a longer page: fall back to the full document.
  const citedMissing = Boolean(cited) && !shown.some((x) => x.id === cited);
  const finalShown = citedMissing && !isFull ? passages.slice(0, FULL_VIEW_CAP) : shown;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/earnings" className="text-sm text-gray-500 hover:text-gray-700">Earnings Events</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/admin/earnings/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          {event.fiscal_period} {event.event_type}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Stored source</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {event.event_date}
        {src ? (
          <> | <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{src.title}</a></>
        ) : null}
        {event.storage_key ? <span className="font-mono text-xs text-gray-400"> | {event.storage_key}</span> : null}
      </p>

      {loadError ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <Link
              href={`/admin/earnings/${id}/source${cited ? `?p=${encodeURIComponent(cited)}` : ""}${cited ? `#${encodeURIComponent(cited)}` : ""}`}
              className={`rounded-full border px-3 py-1 text-xs ${!isFull ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Passages read by extraction ({selectRelevantPassages(passages).length})
            </Link>
            <Link
              href={`/admin/earnings/${id}/source?full=1${cited ? `&p=${encodeURIComponent(cited)}` : ""}${cited ? `#${encodeURIComponent(cited)}` : ""}`}
              className={`rounded-full border px-3 py-1 text-xs ${isFull ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Full document ({passages.length})
            </Link>
            {cited && (
              <span className="text-xs text-gray-500">
                highlighting <span className="font-mono">{cited}</span>
                {citedMissing ? " (outside the extraction view, showing the full document)" : ""}
              </span>
            )}
          </div>

          {passages.length > FULL_VIEW_CAP && (isFull || citedMissing) && (
            <p className="mb-3 text-xs text-amber-700">
              Document has {passages.length} passages; showing the first {FULL_VIEW_CAP}.
            </p>
          )}

          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {finalShown.map((passage) => {
              const isCited = passage.id === cited;
              const quotedStatus = quoted.get(passage.id);
              return (
                <div
                  key={passage.id}
                  id={passage.id}
                  className={`px-4 py-3 scroll-mt-8 ${isCited ? "bg-amber-50 ring-2 ring-amber-300" : ""}`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-gray-400">{passage.id}</span>
                    {passage.speaker && <span className="font-medium text-gray-600">{passage.speaker}</span>}
                    {quotedStatus && (
                      <span className="rounded-full border border-gray-300 px-2 py-0.5 text-gray-500">
                        quoted, {quotedStatus}
                      </span>
                    )}
                    {RELEVANCE_PATTERN.test(passage.text) && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
                        relevant
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{passage.text}</p>
                </div>
              );
            })}
            {finalShown.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                No passages. The document parsed to nothing, which is worth investigating before trusting the
                zero-mention result.
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Passage ids are re-derived from the stored document with the extraction parser, so they match the
            locators recorded at extraction time (version {event.extraction_version ?? "unknown"}) as long as the
            parser has not changed since.
          </p>
        </>
      )}
    </div>
  );
}
