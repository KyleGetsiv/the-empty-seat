import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ATTRIBUTION_STYLES: Record<string, string> = {
  company: "bg-green-50 text-green-700 border-green-200",
  investor: "bg-amber-50 text-amber-700 border-amber-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  analyst: "bg-amber-50 text-amber-700 border-amber-200",
};

export default async function DisclosedMetricsPage() {
  const { data: rows } = await supabaseAdmin
    .from("disclosed_metrics")
    .select("id, metric, value, as_of, scope, attribution, stated_by, companies(display_name)")
    .order("metric", { ascending: true })
    .order("as_of", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Disclosed Metrics</h1>
        <Link
          href="/admin/disclosed-metrics/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New metric
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Metric</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Value</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">As of</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Attribution</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Stated by</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows?.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {(r.companies as { display_name: string } | null)?.display_name ?? ""}
                </td>
                <td className="px-4 py-3 text-gray-900 font-mono text-xs">{r.metric}</td>
                <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                  {Number(r.value).toLocaleString("en-US")}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.as_of}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs ${
                      ATTRIBUTION_STYLES[r.attribution] ?? ATTRIBUTION_STYLES.media
                    }`}
                  >
                    {r.attribution}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-56">
                  <p className="truncate">{r.stated_by}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/disclosed-metrics/${r.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
