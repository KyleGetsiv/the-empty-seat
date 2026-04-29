import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function EditSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: source } = await supabaseAdmin.from("sources").select("*").eq("id", id).single();
  if (!source) notFound();

  async function update(formData: FormData) {
    "use server";
    await supabaseAdmin.from("sources").update({
      url: formData.get("url") as string,
      title: formData.get("title") as string,
      publisher: formData.get("publisher") as string,
      published_at: (formData.get("published_at") as string) || null,
    }).eq("id", id);
    revalidatePath("/methodology/sources");
    redirect("/admin/sources");
  }

  async function remove() {
    "use server";
    await supabaseAdmin.from("sources").delete().eq("id", id);
    revalidatePath("/methodology/sources");
    redirect("/admin/sources");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/sources" className="text-sm text-gray-500 hover:text-gray-700">Sources</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Edit source</h1>
      </div>

      <form action={update} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
          <input name="url" type="url" required defaultValue={source.url} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input name="title" required defaultValue={source.title} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Publisher *</label>
          <input name="publisher" required defaultValue={source.publisher} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Published date</label>
          <input name="published_at" type="date" defaultValue={source.published_at?.slice(0, 10) ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <Link href="/admin/sources" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>

      <form action={remove}>
        <button type="submit" className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete source</button>
      </form>
    </div>
  );
}
