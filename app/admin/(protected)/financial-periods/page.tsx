import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function FinancialPeriodsPage() {
  const { data: periods } = await supabaseAdmin
    .from("financial_periods")
    .select("*, companies(display_name)")
    .order("period_start", { ascending: false })
    .limit(200);

  function fmt(n: number | null) {
    if (n === null) return "—";
    return `$${(n / 1_000_000).toFixed(0)}M`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Financial Periods</h1>
        <Link href="/admin/financial-periods/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New period
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Period</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Revenue</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Opex</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Op. loss</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Disclosed</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {periods?.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.fiscal_period}</td>
                <td className="px-4 py-3 text-gray-500">{(p.companies as { display_name: string } | null)?.display_name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-900">{fmt(p.revenue_usd)}</td>
                <td className="px-4 py-3 text-gray-500">{fmt(p.opex_usd)}</td>
                <td className="px-4 py-3 text-gray-500">{fmt(p.operating_loss_usd)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.is_disclosed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {p.is_disclosed ? "Yes" : "Estimated"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/financial-periods/${p.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
