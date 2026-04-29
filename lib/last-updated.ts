import { createSupabaseServerClient } from "@/lib/supabase/server";

const UPDATED_AT_TABLES = [
  "companies",
  "cities",
  "milestones",
  "financial_periods",
  "site_content",
] as const;

const CREATED_AT_TABLES = [
  "sources",
  "fleet_snapshots",
  "ride_estimates",
] as const;

export async function getGlobalLastUpdated(): Promise<Date | null> {
  const supabase = await createSupabaseServerClient();

  const [updatedResults, createdResults] = await Promise.all([
    Promise.all(
      UPDATED_AT_TABLES.map((t) =>
        supabase.from(t).select("updated_at").order("updated_at", { ascending: false }).limit(1)
      )
    ),
    Promise.all(
      CREATED_AT_TABLES.map((t) =>
        supabase.from(t).select("created_at").order("created_at", { ascending: false }).limit(1)
      )
    ),
  ]);

  const timestamps: number[] = [];

  for (const result of updatedResults) {
    const val = (result.data?.[0] as { updated_at?: string } | undefined)?.updated_at;
    if (val) timestamps.push(new Date(val).getTime());
  }

  for (const result of createdResults) {
    const val = (result.data?.[0] as { created_at?: string } | undefined)?.created_at;
    if (val) timestamps.push(new Date(val).getTime());
  }

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps));
}
