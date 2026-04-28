import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function EditCityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: city }, { data: rawCompanies }] = await Promise.all([
    supabaseAdmin.from("cities").select("*").eq("id", id).single(),
    supabaseAdmin.from("companies").select("id, slug, display_name").order("display_name"),
  ]);
  if (!city) notFound();
  const companies = [
    ...(rawCompanies?.filter((c) => c.slug === "waymo") ?? []),
    ...(rawCompanies?.filter((c) => c.slug !== "waymo") ?? []),
  ];

  async function update(formData: FormData) {
    "use server";
    await supabaseAdmin.from("cities").update({
      company_id: formData.get("company_id") as string,
      name: formData.get("name") as string,
      metro_area: (formData.get("metro_area") as string) || null,
      country: (formData.get("country") as string) || "US",
      status: formData.get("status") as string,
      launch_date: (formData.get("launch_date") as string) || null,
      public_access_date: (formData.get("public_access_date") as string) || null,
      service_area_sq_mi: formData.get("service_area_sq_mi") ? Number(formData.get("service_area_sq_mi")) : null,
      latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
      longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
      notes: (formData.get("notes") as string) || null,
    }).eq("id", id);
    revalidatePath("/");
    redirect("/admin/cities");
  }

  async function remove() {
    "use server";
    await supabaseAdmin.from("cities").delete().eq("id", id);
    revalidatePath("/");
    redirect("/admin/cities");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/cities" className="text-sm text-gray-500 hover:text-gray-700">Cities</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Edit city</h1>
      </div>

      <form action={update} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
          <select name="company_id" required defaultValue={city.company_id} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {companies?.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City name *</label>
          <input name="name" required defaultValue={city.name} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Metro area</label>
          <input name="metro_area" defaultValue={city.metro_area ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <input name="country" defaultValue={city.country} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
          <select name="status" required defaultValue={city.status} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="announced">Announced</option>
            <option value="waitlist">Waitlist</option>
            <option value="public">Public</option>
            <option value="paused">Paused</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Launch date</label>
          <input name="launch_date" type="date" defaultValue={city.launch_date ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Public access date</label>
          <input name="public_access_date" type="date" defaultValue={city.public_access_date ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service area (sq mi)</label>
          <input name="service_area_sq_mi" type="number" step="0.01" defaultValue={city.service_area_sq_mi ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
            <input name="latitude" type="number" step="any" defaultValue={city.latitude ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
            <input name="longitude" type="number" step="any" defaultValue={city.longitude ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea name="notes" rows={3} defaultValue={city.notes ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <Link href="/admin/cities" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>

      <form action={remove}>
        <button type="submit" className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete city</button>
      </form>
    </div>
  );
}
