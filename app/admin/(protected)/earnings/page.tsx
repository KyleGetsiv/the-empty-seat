import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EVENT_TYPES, PROCESSING_STATUSES } from "@/lib/earnings-mentions";
import { EMPTY_COUNTS, getMentionCountsByEvent, getNextUnreviewedEventId } from "@/lib/earnings-review";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  extracted: "bg-blue-50 text-blue-700 border-blue-200",
  reviewed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

// Review-state filter. Processing status says what the pipeline did with the
// document; review state says what is left for a human, which is the question
// this page is usually opened to answer.
const REVIEW_FILTERS = [
  { value: "", label: "Any review state" },
  { value: "pending", label: "Has pending mentions" },
  { value: "done", label: "Fully reviewed" },
  { value: "none", label: "No mentions" },
] as const;

type SearchParams = {
  status?: string;
  type?: string;
  review?: string;
  period?: string;
};

export default async function EarningsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status = "", type = "", review = "", period = "" } = await searchParams;

  let query = supabaseAdmin
    .from("earnings_events")
    .select(
      "id, fiscal_period, event_type, event_date, processing_status, extraction_model, processed_at, error, mentions_dropped, companies!earnings_events_company_id_fkey(display_name)"
    )
    .order("event_date", { ascending: false })
    .limit(200);
  if (status) query = query.eq("processing_status", status);
  if (type) query = query.eq("event_type", type);
  if (period) query = query.ilike("fiscal_period", `%${period}%`);

  const [{ data: events }, counts, nextUnreviewedId] = await Promise.all([
    query,
    getMentionCountsByEvent(),
    getNextUnreviewedEventId(),
  ]);

  // Review state is derived from mention counts, so it filters after the
  // query rather than inside it.
  const rows = (events ?? []).filter((e) => {
    if (!review) return true;
    const c = counts.get(e.id) ?? EMPTY_COUNTS;
    const total = c.pending + c.approved + c.rejected;
    if (review === "pending") return c.pending > 0;
    if (review === "done") return total > 0 && c.pending === 0;
    if (review === "none") return total === 0;
    return true;
  });

  const totalPending = [...counts.values()].reduce((s, c) => s + c.pending, 0);
  const filtered = Boolean(status || type || review || period);

  const selectClass = "rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700";

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Earnings Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalPending > 0 ? `${totalPending} mentions awaiting review` : "No mentions awaiting review"}
            {filtered ? ` | showing ${rows.length} of ${(events ?? []).length} matching events` : ""}
          </p>
        </div>
        {nextUnreviewedId && (
          <Link
            href={`/admin/earnings/${nextUnreviewedId}`}
            className="shrink-0 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Review next unreviewed
          </Link>
        )}
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-gray-600 mb-1">Processing</label>
          <select id="status" name="status" defaultValue={status} className={selectClass}>
            <option value="">Any status</option>
            {PROCESSING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select id="type" name="type" defaultValue={type} className={selectClass}>
            <option value="">Any type</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="review" className="block text-xs font-medium text-gray-600 mb-1">Review</label>
          <select id="review" name="review" defaultValue={review} className={selectClass}>
            {REVIEW_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="period" className="block text-xs font-medium text-gray-600 mb-1">Period</label>
          <input
            id="period"
            name="period"
            defaultValue={period}
            placeholder="e.g. 2025 or Q3"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm w-36"
          />
        </div>
        <button type="submit" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Apply
        </button>
        {filtered && (
          <Link href="/admin/earnings" className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700">
            Clear
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Period</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Pending</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Approved</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Rejected</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Dropped</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  {(events ?? []).length === 0 && !filtered
                    ? "No earnings events yet. The SEC and transcript scrapers (modules 4.2, 4.3) create them."
                    : "No events match these filters."}
                </td>
              </tr>
            )}
            {rows.map((e) => {
              const c = counts.get(e.id) ?? EMPTY_COUNTS;
              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.event_date}</td>
                  <td className="px-4 py-3 text-gray-900">{e.fiscal_period}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">{e.event_type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[e.processing_status] ?? ""}`} title={e.error ?? undefined}>
                      {e.processing_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.pending || ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">{c.approved || ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-400">{c.rejected || ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700" title={e.mentions_dropped ? "Quotes the model returned that were not stored" : undefined}>
                    {e.mentions_dropped || ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/earnings/${e.id}`} className="text-blue-600 hover:underline">Review</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
