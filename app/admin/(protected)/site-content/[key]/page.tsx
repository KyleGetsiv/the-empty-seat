import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function EditSiteContentPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const { data: row } = await supabaseAdmin
    .from("site_content")
    .select("key, markdown_body, updated_at")
    .eq("key", key)
    .single();

  if (!row) notFound();

  async function save(formData: FormData) {
    "use server";
    await supabaseAdmin
      .from("site_content")
      .update({ markdown_body: formData.get("markdown_body") as string })
      .eq("key", key);
    revalidatePath("/");
    revalidatePath("/methodology");
    revalidatePath("/methodology/sources");
    redirect("/admin/site-content");
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/site-content" className="text-sm text-gray-500 hover:text-gray-700">
          Site content
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900 font-mono">{row.key}</h1>
      </div>

      <form action={save} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content (Markdown)
          </label>
          <textarea
            name="markdown_body"
            rows={16}
            defaultValue={row.markdown_body}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
          />
        </div>
        <p className="text-xs text-gray-400">
          Last updated:{" "}
          {new Date(row.updated_at).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
          <Link
            href="/admin/site-content"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
