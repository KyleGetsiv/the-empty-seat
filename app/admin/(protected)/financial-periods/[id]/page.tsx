import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";

export default async function EditFinancialPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: period }, { data: rawCompanies }, { data: sources }] = await Promise.all([
    supabaseAdmin.from("financial_periods").select("*").eq("id", id).single(),
    supabaseAdmin.from("companies").select("id, slug, display_name").order("display_name"),
    supabaseAdmin.from("sources").select("id, title, publisher").order("created_at", { ascending: false }).limit(100),
  ]);
  if (!period) notFound();
  const companies = [
    ...(rawCompanies?.filter((c) => c.slug === "waymo") ?? []),
    ...(rawCompanies?.filter((c) => c.slug !== "waymo") ?? []),
  ];

  async function update(formData: FormData) {
    "use server";
    const { error } = await supabaseAdmin.from("financial_periods").update({
      company_id: formData.get("company_id") as string,
      fiscal_period: formData.get("fiscal_period") as string,
      period_start: formData.get("period_start") as string,
      period_end: formData.get("period_end") as string,
      revenue_usd: formData.get("revenue_usd") ? Number(formData.get("revenue_usd")) : null,
      opex_usd: formData.get("opex_usd") ? Number(formData.get("opex_usd")) : null,
      capex_usd: formData.get("capex_usd") ? Number(formData.get("capex_usd")) : null,
      operating_loss_usd: formData.get("operating_loss_usd") ? Number(formData.get("operating_loss_usd")) : null,
      is_disclosed: formData.get("is_disclosed") === "on",
      source_id: (formData.get("source_id") as string) || null,
      methodology_note: (formData.get("methodology_note") as string) || null,
    }).eq("id", id);
    if (error) {
      console.error("[update financial_periods]", error);
      throw new Error(`Failed to update financial_periods row: ${error.message}`);
    }
    revalidatePath("/");
    redirect("/admin/financial-periods");
  }

  async function remove() {
    "use server";
    const { error } = await supabaseAdmin.from("financial_periods").delete().eq("id", id);
    if (error) {
      console.error("[delete financial_periods]", error);
      throw new Error(`Failed to delete financial_periods row: ${error.message}`);
    }
    revalidatePath("/");
    redirect("/admin/financial-periods");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/financial-periods" className="text-sm text-gray-500 hover:text-gray-700">Financial Periods</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">Edit period</h1>
      </div>

      <form action={update} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
          <select name="company_id" required defaultValue={period.company_id} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {companies?.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal period *</label>
          <input name="fiscal_period" required defaultValue={period.fiscal_period} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period start *</label>
            <input name="period_start" type="date" required defaultValue={period.period_start} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period end *</label>
            <input name="period_end" type="date" required defaultValue={period.period_end} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
        <p className="text-xs text-gray-400">All financial figures in USD (raw numbers).</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Revenue (USD)</label>
          <input name="revenue_usd" type="number" step="1" defaultValue={period.revenue_usd ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opex (USD)</label>
          <input name="opex_usd" type="number" step="1" defaultValue={period.opex_usd ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Capex (USD)</label>
          <input name="capex_usd" type="number" step="1" defaultValue={period.capex_usd ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Operating loss (USD)</label>
          <input name="operating_loss_usd" type="number" step="1" defaultValue={period.operating_loss_usd ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <input name="is_disclosed" type="checkbox" id="is_disclosed" defaultChecked={period.is_disclosed} className="rounded border-gray-300" />
          <label htmlFor="is_disclosed" className="text-sm font-medium text-gray-700">From a disclosed filing (not estimated)</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <select name="source_id" defaultValue={period.source_id ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="">None</option>
            {sources?.map((s) => <option key={s.id} value={s.id}>{s.publisher}: {s.title.slice(0, 60)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Methodology note</label>
          <textarea name="methodology_note" rows={3} defaultValue={period.methodology_note ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <Link href="/admin/financial-periods" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>

      <form action={remove}>
        <ConfirmDeleteButton label="Delete period" />
      </form>
    </div>
  );
}
