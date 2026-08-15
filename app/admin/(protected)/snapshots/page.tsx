import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

const QUALITY_STYLES: Record<string, string> = {
  regulatory: "bg-green-50 text-green-700 border-green-200",
  company_disclosed: "bg-blue-50 text-blue-700 border-blue-200",
  earnings_disclosed: "bg-blue-50 text-blue-700 border-blue-200",
  press_reported: "bg-amber-50 text-amber-700 border-amber-200",
  estimated: "bg-gray-50 text-gray-600 border-gray-200",
};

function fmt(n: number | null): string {
  return n == null ? "" : Number(n).toLocaleString("en-US");
}

export default async function SnapshotsPage() {
  const { data: rows } = await supabaseAdmin
    .from("competitor_snapshots")
    .select("id, snapshot_date, cities_serving_public, vehicle_count, weekly_rides, supervision, disclosure_quality, operator_programs(display_name)")
    .order("snapshot_date", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Competitor Snapshots</h1>
        <Link href="/admin/snapshots/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New snapshot
        </Link>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Program</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Cities</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Vehicles</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Weekly rides</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Supervision</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Quality</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows?.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{(r.operator_programs as { display_name: string } | null)?.display_name ?? ""}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.snapshot_date}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.cities_serving_public)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.vehicle_count)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.weekly_rides)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.supervision ?? ""}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${QUALITY_STYLES[r.disclosure_quality] ?? QUALITY_STYLES.estimated}`}>
                    {r.disclosure_quality}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/snapshots/${r.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
