import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function EditFleetSnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: snapshot }, { data: rawCompanies }, { data: cities }, { data: sources }] = await Promise.all([
    supabaseAdmin.from("fleet_snapshots").select("*").eq("id", id).single(),
    supabaseAdmin.from("companies").select("id, slug, display_name").order("display_name"),
    supabaseAdmin.from("cities").select("id, name").order("name"),
    supabaseAdmin.from("sources").select("id, title, publisher").order("created_at", { ascending: false }).limit(100),
  ]);
  if (!snapshot) notFound();
  const companies = [
    ...(rawCompanies?.filter((c) => c.slug === "waymo") ?? []),
    ...(rawCompanies?.filter((c) => c.slug !== "waymo") ?? []),
  ];

  async function update(formData: FormData) {
    "use server";
    await supabaseAdmin.from("fleet_snapshots").update({
      company_id: formData.get("company_id") as string,
      city_id: (formData.get("city_id") as string) || null,
      snapshot_date: formData.get("snapshot_date") as string,
      vehicle_count: Number(formData.get("vehicle_count")),
      active_vehicle_count: formData.get("active_vehicle_count") ? Number(formData.get("active_vehicle_count")) : null,
      source_id: (formData.get("source_id") as string) || null,
      notes: (formData.get("notes") as string) || null,
    }).eq("id", id);
    redirect("/admin/fleet-snapshots");
  }

  async function remove() {
    "use server";
    await supabaseAdmin.from("fleet_snapshots").delete().eq("id", id);
    redirect("/admin/fleet-snapshots");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/fleet-snapshots" className="text-sm text-gray-500 hover:text-gray-700">Fleet Snapshots</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Edit snapshot</h1>
      </div>

      <form action={update} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
          <select name="company_id" required defaultValue={snapshot.company_id} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {companies?.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City (blank = company-wide)</label>
          <select name="city_id" defaultValue={snapshot.city_id ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="">Company-wide</option>
            {cities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot date *</label>
          <input name="snapshot_date" type="date" required defaultValue={snapshot.snapshot_date} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle count *</label>
          <input name="vehicle_count" type="number" required min="0" defaultValue={snapshot.vehicle_count} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Active vehicle count</label>
          <input name="active_vehicle_count" type="number" min="0" defaultValue={snapshot.active_vehicle_count ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <select name="source_id" defaultValue={snapshot.source_id ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="">None</option>
            {sources?.map((s) => <option key={s.id} value={s.id}>{s.publisher}: {s.title.slice(0, 60)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea name="notes" rows={3} defaultValue={snapshot.notes ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <Link href="/admin/fleet-snapshots" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>

      <form action={remove}>
        <button type="submit" className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete snapshot</button>
      </form>
    </div>
  );
}
