import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

const SUPERVISION = ['driverless', 'safety_operator', 'mixed', 'human_is_legal_driver'];
const QUALITY = ['regulatory', 'company_disclosed', 'earnings_disclosed', 'press_reported', 'estimated'];

export default async function NewSnapshotPage() {
  const [{ data: programs }, { data: sources }] = await Promise.all([
    supabaseAdmin.from("operator_programs").select("id, display_name").order("display_name"),
    supabaseAdmin.from("sources").select("id, title, publisher").order("created_at", { ascending: false }).limit(150),
  ]);

  async function create(formData: FormData) {
    "use server";
    const { error } = await supabaseAdmin.from("competitor_snapshots").insert({
      program_id: formData.get("program_id") as string,
      snapshot_date: formData.get("snapshot_date") as string,
      cities_serving_public: formData.get("cities_serving_public") ? Number(formData.get("cities_serving_public")) : null,
      cities_operating_total: formData.get("cities_operating_total") ? Number(formData.get("cities_operating_total")) : null,
      vehicle_count: formData.get("vehicle_count") ? Number(formData.get("vehicle_count")) : null,
      weekly_rides: formData.get("weekly_rides") ? Number(formData.get("weekly_rides")) : null,
      cumulative_rides: formData.get("cumulative_rides") ? Number(formData.get("cumulative_rides")) : null,
      autonomous_miles_cumulative: formData.get("autonomous_miles_cumulative") ? Number(formData.get("autonomous_miles_cumulative")) : null,
      funding_total_usd: formData.get("funding_total_usd") ? Number(formData.get("funding_total_usd")) : null,
      implied_valuation_usd: formData.get("implied_valuation_usd") ? Number(formData.get("implied_valuation_usd")) : null,
      supervision: (formData.get("supervision") as string) || null,
      disclosure_quality: formData.get("disclosure_quality") as string,
      source_id: (formData.get("source_id") as string) || null,
      notes: (formData.get("notes") as string) || null,
    });
    if (error) {
      console.error("[create competitor_snapshots]", error);
      throw new Error(`Failed to create competitor_snapshots row: ${error.message}`);
    }
    revalidatePath("/landscape");
    redirect("/admin/snapshots");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/snapshots" className="text-sm text-gray-500 hover:text-gray-700">Competitor Snapshots</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">New snapshot</h1>
      </div>
      <form action={create} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Program *</label>
          <select name="program_id" required className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {programs?.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot date *</label>
          <input name="snapshot_date" type="date" required className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cities serving public</label>
          <input name="cities_serving_public" type="number" step="any" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cities operating (incl. employee/supervised)</label>
          <input name="cities_operating_total" type="number" step="any" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle count</label>
          <input name="vehicle_count" type="number" step="any" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Weekly rides</label>
          <input name="weekly_rides" type="number" step="any" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cumulative rides</label>
          <input name="cumulative_rides" type="number" step="any" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Autonomous miles (cumulative)</label>
          <input name="autonomous_miles_cumulative" type="number" step="any" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Funding total (USD)</label>
          <input name="funding_total_usd" type="number" step="any" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Implied valuation (USD)</label>
          <input name="implied_valuation_usd" type="number" step="any" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supervision</label>
            <select name="supervision" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="">Unknown</option>
              {SUPERVISION.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Disclosure quality *</label>
            <select name="disclosure_quality" required defaultValue="company_disclosed" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              {QUALITY.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <select name="source_id" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="">None</option>
            {sources?.map((s) => <option key={s.id} value={s.id}>{s.publisher}: {s.title.slice(0, 60)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea name="notes" rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Create</button>
          <Link href="/admin/snapshots" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
