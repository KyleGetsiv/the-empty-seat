import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: company } = await supabaseAdmin.from("companies").select("*").eq("id", id).single();
  if (!company) notFound();

  async function update(formData: FormData) {
    "use server";
    const { error } = await supabaseAdmin.from("companies").update({
      display_name: formData.get("display_name") as string,
      slug: formData.get("slug") as string,
      parent_company: (formData.get("parent_company") as string) || null,
      founded_year: formData.get("founded_year") ? Number(formData.get("founded_year")) : null,
    }).eq("id", id);
    if (error) {
      console.error("[update companies]", error);
      throw new Error(`Failed to update companies row: ${error.message}`);
    }
    redirect("/admin/companies");
  }

  async function remove() {
    "use server";
    const { error } = await supabaseAdmin.from("companies").delete().eq("id", id);
    if (error) {
      console.error("[delete companies]", error);
      throw new Error(`Failed to delete companies row: ${error.message}`);
    }
    redirect("/admin/companies");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/companies" className="text-sm text-gray-500 hover:text-gray-700">Companies</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Edit company</h1>
      </div>

      <form action={update} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
          <input name="display_name" required defaultValue={company.display_name} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
          <input name="slug" required defaultValue={company.slug} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none font-mono" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parent company</label>
          <input name="parent_company" defaultValue={company.parent_company ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Founded year</label>
          <input name="founded_year" type="number" defaultValue={company.founded_year ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <Link href="/admin/companies" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>

      <form action={remove} onSubmit={() => confirm("Delete this company?") || event?.preventDefault()}>
        <button type="submit" className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          Delete company
        </button>
      </form>
    </div>
  );
}
