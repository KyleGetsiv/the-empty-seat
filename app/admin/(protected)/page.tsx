import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

const tables = [
  { label: "Milestones", key: "milestones", href: "/admin/milestones" },
  { label: "Cities", key: "cities", href: "/admin/cities" },
  { label: "Fleet Snapshots", key: "fleet_snapshots", href: "/admin/fleet-snapshots" },
  { label: "Ride Estimates", key: "ride_estimates", href: "/admin/ride-estimates" },
  { label: "Financial Periods", key: "financial_periods", href: "/admin/financial-periods" },
  { label: "Sources", key: "sources", href: "/admin/sources" },
  { label: "Companies", key: "companies", href: "/admin/companies" },
] as const;

async function getCount(table: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from(table as "milestones")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminDashboard() {
  const counts = await Promise.all(
    tables.map(async (t) => ({ ...t, count: await getCount(t.key) }))
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">Row counts across all tables.</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {counts.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className="block rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <p className="text-2xl font-semibold text-gray-900">{t.count}</p>
            <p className="text-sm text-gray-500 mt-1">{t.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
