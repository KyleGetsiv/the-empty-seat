import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export default async function MilestonesPage() {
  const { data: milestones } = await supabaseAdmin
    .from("milestones")
    .select("id, event_date, headline, tags, is_published, kyle_annotation")
    .order("event_date", { ascending: false })
    .limit(200);

  async function togglePublished(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const current = formData.get("current") === "true";
    await supabaseAdmin.from("milestones").update({ is_published: !current }).eq("id", id);
    revalidatePath("/admin/milestones");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Milestones</h1>
        <Link href="/admin/milestones/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New milestone
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Headline</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tags</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Published</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {milestones?.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.event_date}</td>
                <td className="px-4 py-3 text-gray-900 max-w-sm">
                  <p className="truncate font-medium">{m.headline}</p>
                  {m.kyle_annotation && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{m.kyle_annotation}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.tags?.map((tag) => (
                      <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <form action={togglePublished}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="current" value={String(m.is_published)} />
                    <button
                      type="submit"
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        m.is_published ? "bg-green-500" : "bg-gray-200"
                      }`}
                      title={m.is_published ? "Published — click to unpublish" : "Draft — click to publish"}
                      aria-label={m.is_published ? "Published" : "Draft"}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                        m.is_published ? "translate-x-4" : "translate-x-0.5"
                      }`} />
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/milestones/${m.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
