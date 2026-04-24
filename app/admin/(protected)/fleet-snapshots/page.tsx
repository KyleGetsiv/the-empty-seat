import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function FleetSnapshotsPage() {
  const { data: snapshots } = await supabaseAdmin
    .from("fleet_snapshots")
    .select("*, companies(display_name), cities(name)")
    .order("snapshot_date", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Fleet Snapshots</h1>
        <Link href="/admin/fleet-snapshots/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New snapshot
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">City</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Vehicles</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {snapshots?.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{s.snapshot_date}</td>
                <td className="px-4 py-3 text-gray-900">{(s.companies as { display_name: string } | null)?.display_name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{(s.cities as { name: string } | null)?.name ?? "Company-wide"}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">{s.vehicle_count}</td>
                <td className="px-4 py-3 text-gray-500">{s.active_vehicle_count ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/fleet-snapshots/${s.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
