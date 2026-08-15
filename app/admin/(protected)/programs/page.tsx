import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ProgramsPage() {
  const { data: programs } = await supabaseAdmin
    .from("operator_programs")
    .select("id, slug, display_name, is_active, summary, companies!operator_programs_lead_company_id_fkey(display_name)")
    .order("display_name");

  const { data: roles } = await supabaseAdmin
    .from("operator_program_roles")
    .select("program_id, role, companies(display_name)");

  const rolesByProgram = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const name = (r.companies as { display_name: string } | null)?.display_name ?? "?";
    const list = rolesByProgram.get(r.program_id) ?? [];
    list.push(`${name}: ${r.role}`);
    rolesByProgram.set(r.program_id, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Operator Programs</h1>
        <Link href="/admin/programs/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New program
        </Link>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Program</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Lead</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Roles</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {programs?.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{p.display_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{p.slug}</p>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {(p.companies as { display_name: string } | null)?.display_name ?? ""}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {(rolesByProgram.get(p.id) ?? []).map((r) => (
                    <span key={r} className="inline-block rounded bg-gray-100 px-1.5 py-0.5 mr-1 mb-1">{r}</span>
                  ))}
                </td>
                <td className="px-4 py-3 text-center">{p.is_active ? "yes" : "no"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/programs/${p.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
