import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

const ROLES = ["av_developer", "vehicle_platform", "fleet_operator", "network"] as const;

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: prog }, { data: companies }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("operator_programs").select("*").eq("id", id).single(),
    supabaseAdmin.from("companies").select("id, slug, display_name").order("display_name"),
    supabaseAdmin.from("operator_program_roles").select("company_id, role").eq("program_id", id),
  ]);
  if (!prog) notFound();
  const has = new Set((roles ?? []).map((r) => `${r.company_id}__${r.role}`));

  async function update(formData: FormData) {
    "use server";
    const { error } = await supabaseAdmin
      .from("operator_programs")
      .update({
        slug: formData.get("slug") as string,
        display_name: formData.get("display_name") as string,
        lead_company_id: formData.get("lead_company_id") as string,
        summary: (formData.get("summary") as string) || null,
        is_active: formData.get("is_active") === "on",
      })
      .eq("id", id);
    if (error) {
      console.error("[update operator_programs]", error);
      throw new Error(`Failed to update operator_programs row: ${error.message}`);
    }
    // Replace role set wholesale (small table, simplest correct behavior)
    const { error: delError } = await supabaseAdmin.from("operator_program_roles").delete().eq("program_id", id);
    if (delError) throw new Error(`Failed to reset operator_program_roles: ${delError.message}`);
    const roleRows: { program_id: string; company_id: string; role: string }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("role__") && value === "on") {
        const [, companyId, role] = key.split("__");
        roleRows.push({ program_id: id, company_id: companyId, role });
      }
    }
    if (roleRows.length > 0) {
      const { error: roleError } = await supabaseAdmin.from("operator_program_roles").insert(roleRows);
      if (roleError) throw new Error(`Failed to write operator_program_roles: ${roleError.message}`);
    }
    revalidatePath("/landscape");
    redirect("/admin/programs");
  }

  async function remove() {
    "use server";
    const { error } = await supabaseAdmin.from("operator_programs").delete().eq("id", id);
    if (error) {
      console.error("[delete operator_programs]", error);
      throw new Error(`Failed to delete operator_programs row: ${error.message}`);
    }
    revalidatePath("/landscape");
    redirect("/admin/programs");
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/programs" className="text-sm text-gray-500 hover:text-gray-700">Operator Programs</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Edit program</h1>
      </div>
      <form action={update} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
            <input name="slug" required defaultValue={prog.slug} className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
            <input name="display_name" required defaultValue={prog.display_name} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lead company *</label>
          <select name="lead_company_id" required defaultValue={prog.lead_company_id} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {companies?.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
          <textarea name="summary" rows={2} defaultValue={prog.summary ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="is_active" defaultChecked={prog.is_active} /> Active
        </label>
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Roles</p>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="text-left pr-4 pb-1 text-gray-500">Company</th>
                  {ROLES.map((r) => <th key={r} className="px-2 pb-1 text-gray-500 font-normal">{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {companies?.map((c) => (
                  <tr key={c.id}>
                    <td className="pr-4 py-0.5 text-gray-700">{c.display_name}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-2 text-center">
                        <input type="checkbox" name={`role__${c.id}__${r}`} defaultChecked={has.has(`${c.id}__${r}`)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <Link href="/admin/programs" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
      <form action={remove}>
        <ConfirmDeleteButton label="Delete program" />
      </form>
    </div>
  );
}
