import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function SourcesPage() {
  const { data: sources } = await supabaseAdmin
    .from("sources")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Sources</h1>
        <Link href="/admin/sources/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New source
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Publisher</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Published</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sources?.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">{s.title}</a>
                </td>
                <td className="px-4 py-3 text-gray-500">{s.publisher}</td>
                <td className="px-4 py-3 text-gray-500">{s.published_at ? s.published_at.slice(0, 10) : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/sources/${s.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
