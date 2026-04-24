import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function CompaniesPage() {
  const { data: companies } = await supabaseAdmin
    .from("companies")
    .select("*")
    .order("display_name");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Companies</h1>
        <Link
          href="/admin/companies/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New company
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Parent</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Founded</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies?.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.display_name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-3 text-gray-500">{c.parent_company ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{c.founded_year ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/companies/${c.id}`}
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
