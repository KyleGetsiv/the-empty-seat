import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function CitiesPage() {
  const { data: cities } = await supabaseAdmin
    .from("cities")
    .select("*, companies(display_name)")
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Cities</h1>
        <Link href="/admin/cities/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New city
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">City</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Launch date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Sq mi</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cities?.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{(c.companies as { display_name: string } | null)?.display_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.status === "public" ? "bg-green-100 text-green-700" :
                    c.status === "waitlist" ? "bg-yellow-100 text-yellow-700" :
                    c.status === "announced" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.launch_date ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{c.service_area_sq_mi ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/cities/${c.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
