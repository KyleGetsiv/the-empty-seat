import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function SiteContentPage() {
  const { data: rows } = await supabaseAdmin
    .from("site_content")
    .select("key, updated_at")
    .order("key");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Site content</h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Key</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Last updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows?.map((r) => (
              <tr key={r.key} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 font-mono">{r.key}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(r.updated_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/site-content/${r.key}`} className="text-blue-600 hover:underline">
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
