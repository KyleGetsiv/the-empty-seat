import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DISCLOSED_METRIC_PLACEHOLDER = `value: 500000
as_of: 2026-03-26
source_id: <paste-source-uuid-here>`;

export default async function SiteContentPage() {
  const { data: rows } = await supabaseAdmin
    .from("site_content")
    .select("key, updated_at")
    .order("key");

  async function createKey(formData: FormData) {
    "use server";
    const key = (formData.get("key") as string).trim();
    const markdown_body = (formData.get("markdown_body") as string).trim();
    if (!key) return;

    const { data: existing } = await supabaseAdmin
      .from("site_content")
      .select("key")
      .eq("key", key)
      .single();

    if (existing) {
      redirect(`/admin/site-content/${key}`);
    }

    const { data, error } = await supabaseAdmin
      .from("site_content")
      .insert({ key, markdown_body })
      .select()
      .single();

    if (error) {
      console.error("[create site_content key]", error);
      throw new Error(`Failed to insert site_content row: ${error.message}`);
    }

    revalidatePath("/");
    revalidatePath("/methodology");
    revalidatePath("/admin/site-content");
    redirect(`/admin/site-content/${data.key}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Site content</h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-10">
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

      <div className="rounded-lg border border-gray-200 bg-white p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Create new key</h2>
        <p className="text-sm text-gray-500 mb-4">
          For <span className="font-mono text-gray-700">latest_*_disclosed</span> keys, use the
          structured format shown in the placeholder below (value, as_of, source_id). The
          source row must already exist in the sources table before saving.
        </p>
        <form action={createKey} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
            <input
              name="key"
              type="text"
              required
              placeholder="e.g. latest_weekly_rides_disclosed"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial content (optional)
            </label>
            <textarea
              name="markdown_body"
              rows={5}
              placeholder={DISCLOSED_METRIC_PLACEHOLDER}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create and edit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
