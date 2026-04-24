import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function RideEstimatesPage() {
  const { data: estimates } = await supabaseAdmin
    .from("ride_estimates")
    .select("*, companies(display_name), cities(name)")
    .order("period_start", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Ride Estimates</h1>
        <Link href="/admin/ride-estimates/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New estimate
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Period</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">City</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Rides/wk</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Confidence</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {estimates?.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.period_start} – {e.period_end}</td>
                <td className="px-4 py-3 text-gray-900">{(e.companies as { display_name: string } | null)?.display_name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{(e.cities as { name: string } | null)?.name ?? "Company-wide"}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{e.rides_per_week.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.confidence === "high" ? "bg-green-100 text-green-700" :
                    e.confidence === "medium" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>{e.confidence}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/ride-estimates/${e.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
