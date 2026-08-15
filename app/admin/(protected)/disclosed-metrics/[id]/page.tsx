import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

const METRICS = ["weekly_rides", "cumulative_trips", "fleet_size", "cities_count"];
const ATTRIBUTIONS = ["company", "investor", "media", "analyst"];

export default async function EditDisclosedMetricPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ data: row }, { data: rawCompanies }, { data: sources }] = await Promise.all([
    supabaseAdmin.from("disclosed_metrics").select("*").eq("id", id).single(),
    supabaseAdmin.from("companies").select("id, slug, display_name").order("display_name"),
    supabaseAdmin
      .from("sources")
      .select("id, title, publisher")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (!row) notFound();
  const companies = [
    ...(rawCompanies?.filter((c) => c.slug === "waymo") ?? []),
    ...(rawCompanies?.filter((c) => c.slug !== "waymo") ?? []),
  ];

  async function update(formData: FormData) {
    "use server";
    const { error } = await supabaseAdmin
      .from("disclosed_metrics")
      .update({
        company_id: formData.get("company_id") as string,
        metric: formData.get("metric") as string,
        value: Number(formData.get("value")),
        as_of: formData.get("as_of") as string,
        scope: (formData.get("scope") as string) || "worldwide",
        attribution: formData.get("attribution") as string,
        source_id: (formData.get("source_id") as string) || null,
        stated_by: (formData.get("stated_by") as string) || null,
        notes: (formData.get("notes") as string) || null,
      })
      .eq("id", id);
    if (error) {
      console.error("[update disclosed_metrics]", error);
      throw new Error(`Failed to update disclosed_metrics row: ${error.message}`);
    }
    revalidatePath("/");
    redirect("/admin/disclosed-metrics");
  }

  async function remove() {
    "use server";
    const { error } = await supabaseAdmin.from("disclosed_metrics").delete().eq("id", id);
    if (error) {
      console.error("[delete disclosed_metrics]", error);
      throw new Error(`Failed to delete disclosed_metrics row: ${error.message}`);
    }
    revalidatePath("/");
    redirect("/admin/disclosed-metrics");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/disclosed-metrics" className="text-sm text-gray-500 hover:text-gray-700">
          Disclosed Metrics
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Edit metric</h1>
      </div>

      <form action={update} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
          <select name="company_id" required defaultValue={row.company_id} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {companies?.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Metric *</label>
          <select name="metric" required defaultValue={row.metric} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {METRICS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
            <input name="value" type="number" required min="0" step="any" defaultValue={Number(row.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">As of *</label>
            <input name="as_of" type="date" required defaultValue={row.as_of} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <input name="scope" defaultValue={row.scope} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attribution *</label>
            <select name="attribution" required defaultValue={row.attribution} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              {ATTRIBUTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stated by</label>
          <input name="stated_by" defaultValue={row.stated_by ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <select name="source_id" defaultValue={row.source_id ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="">None</option>
            {sources?.map((s) => (
              <option key={s.id} value={s.id}>{s.publisher}: {s.title.slice(0, 60)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea name="notes" rows={3} defaultValue={row.notes ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <Link href="/admin/disclosed-metrics" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>

      <form action={remove}>
        <button type="submit" className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          Delete metric
        </button>
      </form>
    </div>
  );
}
