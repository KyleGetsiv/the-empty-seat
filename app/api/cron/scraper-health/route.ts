import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/notify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  expectedQuarters,
  filingDeadline,
  isOverdue,
  quarterLabel,
  quarterDateRange,
  CPUC_PAGE_URL,
} from "@/lib/cpuc-calendar";

// Vercel Cron fires this daily at 09:00 UTC (configured in vercel.json).
// Reports the freshness of the CPUC quarterly series: which expected quarters
// are in the database, which are pending at CPUC, and which are overdue.
// Escalates to a Slack WARN only for overdue quarters, so the daily message
// stays quiet-but-alive the rest of the time.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const { data: waymo } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();

  if (!waymo) {
    await notifySlack("Scraper health: waymo company row missing", "error");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { data: rows } = await supabaseAdmin
    .from("ride_estimates")
    .select("period_start, created_at")
    .eq("company_id", waymo.id)
    .is("city_id", null);

  const present = new Set((rows ?? []).map((r) => r.period_start as string));

  const missing: string[] = [];
  const overdue: string[] = [];
  for (const qt of expectedQuarters(now)) {
    const { period_start } = quarterDateRange(qt);
    if (present.has(period_start)) continue;
    if (isOverdue(qt, now)) overdue.push(quarterLabel(qt));
    else
      missing.push(
        `${quarterLabel(qt)} (due ${filingDeadline(qt).toISOString().slice(0, 10)})`
      );
  }

  const latestIngest = (rows ?? [])
    .map((r) => new Date(r.created_at as string).getTime())
    .sort((a, b) => b - a)[0];
  const daysSinceIngest = latestIngest
    ? Math.floor((now.getTime() - latestIngest) / 86_400_000)
    : null;

  const { count: pilotCount } = await supabaseAdmin
    .from("ride_estimates")
    .select("id", { count: "exact", head: true })
    .eq("tier", "pilot");

  const summary = [
    `Scraper health: ${present.size} CPUC deployment quarters, ${pilotCount ?? 0} pilot rows in DB` +
      (daysSinceIngest !== null
        ? `, last ingest ${daysSinceIngest}d ago.`
        : "."),
    missing.length > 0 ? `Pending at CPUC: ${missing.join(", ")}.` : "",
    overdue.length > 0
      ? `OVERDUE: ${overdue.join(", ")}. Check ${CPUC_PAGE_URL}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  await notifySlack(summary, overdue.length > 0 ? "warn" : "info");

  return NextResponse.json({
    ok: true,
    quartersInDb: present.size,
    pending: missing,
    overdue,
  });
}
