import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MILESTONE_TAGS, tagLabel } from "@/lib/milestones/tags";
import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

export default async function EditMilestonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: milestone }, { data: rawCompanies }, { data: sources }] = await Promise.all([
    supabaseAdmin.from("milestones").select("*").eq("id", id).single(),
    supabaseAdmin.from("companies").select("id, slug, display_name").order("display_name"),
    supabaseAdmin.from("sources").select("id, title, publisher").order("created_at", { ascending: false }).limit(100),
  ]);
  if (!milestone) notFound();
  const companies = [
    ...(rawCompanies?.filter((c) => c.slug === "waymo") ?? []),
    ...(rawCompanies?.filter((c) => c.slug !== "waymo") ?? []),
  ];

  async function update(formData: FormData) {
    "use server";
    const tags = MILESTONE_TAGS.filter((t) => formData.get(`tag_${t}`) === "on");
    const { error } = await supabaseAdmin.from("milestones").update({
      company_id: formData.get("company_id") as string,
      event_date: formData.get("event_date") as string,
      headline: formData.get("headline") as string,
      body: (formData.get("body") as string) || null,
      tags: tags.length ? tags : null,
      source_id: (formData.get("source_id") as string) || null,
      kyle_annotation: (formData.get("kyle_annotation") as string) || null,
      is_published: formData.get("is_published") === "on",
    }).eq("id", id);
    if (error) {
      console.error("[update milestones]", error);
      throw new Error(`Failed to update milestones row: ${error.message}`);
    }
    revalidatePath("/milestones");
    revalidatePath("/");
    redirect("/admin/milestones");
  }

  async function remove() {
    "use server";
    const { error } = await supabaseAdmin.from("milestones").delete().eq("id", id);
    if (error) {
      console.error("[delete milestones]", error);
      throw new Error(`Failed to delete milestones row: ${error.message}`);
    }
    revalidatePath("/milestones");
    revalidatePath("/");
    redirect("/admin/milestones");
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/milestones" className="text-sm text-gray-500 hover:text-gray-700">Milestones</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Edit milestone</h1>
      </div>

      <form action={update} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 mb-6">
        {/* Publish toggle */}
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 border ${milestone.is_published ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {milestone.is_published ? "Published" : "Draft"}
            </p>
            <p className="text-xs text-gray-500">Toggle to change public visibility</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input name="is_published" type="checkbox" defaultChecked={milestone.is_published} className="sr-only peer" />
            <div className="relative h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-green-500 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
            <span className="text-sm font-medium text-gray-700">Published</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
          <select name="company_id" required defaultValue={milestone.company_id} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {companies?.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event date *</label>
          <input name="event_date" type="date" required defaultValue={milestone.event_date} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Headline *</label>
          <input name="headline" required defaultValue={milestone.headline} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body (markdown)</label>
          <textarea name="body" rows={6} defaultValue={milestone.body ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none font-mono" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <div className="flex flex-wrap gap-2">
            {MILESTONE_TAGS.map((tag) => (
              <label key={tag} className="group cursor-pointer">
                <input type="checkbox" name={`tag_${tag}`} defaultChecked={milestone.tags?.includes(tag)} className="sr-only peer" />
                <span className="inline-block rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition-colors peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 group-hover:border-gray-400">
                  {tagLabel(tag)}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <select name="source_id" defaultValue={milestone.source_id ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="">None</option>
            {sources?.map((s) => <option key={s.id} value={s.id}>{s.publisher}: {s.title.slice(0, 60)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">My annotation (1 sentence)</label>
          <input name="kyle_annotation" defaultValue={milestone.kyle_annotation ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <Link href="/admin/milestones" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>

      <form action={remove}>
        <ConfirmDeleteButton label="Delete milestone" />
      </form>
    </div>
  );
}
