import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  extracted: "bg-blue-50 text-blue-700 border-blue-200",
  reviewed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export default async function EarningsAdminPage() {
  const [{ data: events }, { data: mentionCounts }] = await Promise.all([
    supabaseAdmin
      .from("earnings_events")
      .select("id, fiscal_period, event_type, event_date, processing_status, extraction_model, processed_at, error, companies!earnings_events_company_id_fkey(display_name)")
      .order("event_date", { ascending: false })
      .limit(200),
    supabaseAdmin.from("waymo_mentions").select("earnings_event_id, review_status"),
  ]);

  const counts = new Map<string, { pending: number; approved: number; rejected: number }>();
  for (const m of mentionCounts ?? []) {
    const c = counts.get(m.earnings_event_id) ?? { pending: 0, approved: 0, rejected: 0 };
    c[m.review_status as "pending" | "approved" | "rejected"]++;
    counts.set(m.earnings_event_id, c);
  }
  const totalPending = [...counts.values()].reduce((s, c) => s + c.pending, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Earnings Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalPending > 0 ? `${totalPending} mentions awaiting review` : "No mentions awaiting review"}
          </p>
        </div>
      </div>
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
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(events ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No earnings events yet. The SEC and transcript scrapers (modules 4.2, 4.3) create them.
                </td>
              </tr>
            )}
            {events?.map((e) => {
              const c = counts.get(e.id) ?? { pending: 0, approved: 0, rejected: 0 };
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
