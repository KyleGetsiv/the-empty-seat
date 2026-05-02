import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default function NewCompanyPage() {
  async function create(formData: FormData) {
    "use server";
    const { error } = await supabaseAdmin.from("companies").insert({
      display_name: formData.get("display_name") as string,
      slug: formData.get("slug") as string,
      parent_company: (formData.get("parent_company") as string) || null,
      founded_year: formData.get("founded_year")
        ? Number(formData.get("founded_year"))
        : null,
    });
    if (error) {
      console.error("[create companies]", error);
      throw new Error(`Failed to create companies row: ${error.message}`);
    }
    redirect("/admin/companies");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/companies" className="text-sm text-gray-500 hover:text-gray-700">
          Companies
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">New company</h1>
      </div>

      <form action={create} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
          <input name="display_name" required className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug * (e.g. waymo)</label>
          <input name="slug" required pattern="[a-z0-9-]+" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none font-mono" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parent company</label>
          <input name="parent_company" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Founded year</label>
          <input name="founded_year" type="number" min="1900" max="2100" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Create
          </button>
          <Link href="/admin/companies" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
