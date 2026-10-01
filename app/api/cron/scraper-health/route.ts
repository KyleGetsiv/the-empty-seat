import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/notify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  expectedQuarters,
  filingDeadline,
  isOverdue,
  quarterLabel,
  quarterDateRange,
  classifyMissingQuarter,
  CPUC_PAGE_URL,
} from "@/lib/cpuc-calendar";
import { deploymentZipUrl, zipAvailability } from "@/lib/scrapers/cpuc";

// Vercel Cron fires this daily at 09:00 UTC (configured in vercel.json).
// Reports the freshness of the CPUC quarterly series: which expected quarters
// are in the database, which are pending at CPUC, and which are overdue.
// Escalates to a Slack WARN only for overdue quarters, so the daily message
// stays quiet-but-alive the rest of the time.
//
// fix(2.2): two ways this message misled in September 2026. It said "Pending
// at CPUC" for 25 days while CPUC was serving the zip and the scraper was
// failing on it, because it read absence from the DB as absence at CPUC; it
// now asks CPUC (one HEAD per missing quarter) and says "INGEST FAILING" when
// the zip is live. And on 2026-09-13 a failed query read as zero rows and
// reported every quarter overdue; a query error is now its own error-level
// message and a 500, never a count.
const HEAD_DELAY_MS = 2000;
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const fail = async (what: string, message: string | undefined) => {
    await notifySlack(`Scraper health query failed (${what}): ${message ?? "no data returned"}. Counts not reported.`, "error");
    return NextResponse.json({ ok: false, error: what }, { status: 500 });
  };

  const { data: waymo, error: waymoError } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();
  if (waymoError) return fail("waymo company row", waymoError.message);
  if (!waymo) {
    await notifySlack("Scraper health: waymo company row missing", "error");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("ride_estimates")
    .select("period_start, created_at")
    .eq("company_id", waymo.id)
    .is("city_id", null);
  if (rowsError || !rows) return fail("deployment quarters", rowsError?.message);

  const present = new Set(rows.map((r) => r.period_start as string));

  const userAgent = process.env.SCRAPER_USER_AGENT ?? "TheEmptySeat/1.0";
  const ingestFailing: string[] = [];
  const missing: string[] = [];
  const overdue: string[] = [];
  const unchecked: string[] = [];
  let checked = 0;
  for (const qt of expectedQuarters(now)) {
    const { period_start } = quarterDateRange(qt);
    if (present.has(period_start)) continue;

    let zipStatus: number | null = null;
    try {
      if (checked++ > 0) await new Promise((r) => setTimeout(r, HEAD_DELAY_MS));
      const res = await fetch(deploymentZipUrl(qt), {
        method: "HEAD",
        headers: { "User-Agent": userAgent },
        redirect: "manual",
      });
      // CPUC answers a not-yet-posted quarter with a 302; normalize so a
      // redirect or an HTML page never reads as a posted zip.
      const a = zipAvailability(res.status, res.headers.get("content-type"));
      zipStatus = a === "served" ? 200 : a === "absent" ? 404 : a.status;
    } catch {
      zipStatus = null;
    }

    const label = quarterLabel(qt);
    const due = filingDeadline(qt).toISOString().slice(0, 10);
    const state = classifyMissingQuarter(zipStatus, isOverdue(qt, now));
    if (state === "ingest_failing") ingestFailing.push(label);
    else if (state === "overdue" || state === "unknown_overdue") overdue.push(label);
    else missing.push(`${label} (due ${due})`);
    if (state.startsWith("unknown")) unchecked.push(`${label}: ${zipStatus === null ? "no response" : `HTTP ${zipStatus}`}`);
  }

  const latestIngest = rows
    .map((r) => new Date(r.created_at as string).getTime())
    .sort((a, b) => b - a)[0];
  const daysSinceIngest = latestIngest
    ? Math.floor((now.getTime() - latestIngest) / 86_400_000)
    : null;

  const { count: pilotCount, error: pilotError } = await supabaseAdmin
    .from("ride_estimates")
    .select("id", { count: "exact", head: true })
    .eq("tier", "pilot");
  if (pilotError || pilotCount === null) return fail("pilot rows", pilotError?.message);

  const summary = [
    `Scraper health: ${present.size} CPUC deployment quarters, ${pilotCount} pilot rows in DB` +
      (daysSinceIngest !== null
        ? `, last ingest ${daysSinceIngest}d ago.`
        : "."),
    ingestFailing.length > 0
      ? `INGEST FAILING: ${ingestFailing.join(", ")} posted at CPUC but not in the DB. Check the scrape-cpuc Actions runs.`
      : "",
    missing.length > 0 ? `Pending at CPUC: ${missing.join(", ")}.` : "",
    overdue.length > 0
      ? `OVERDUE: ${overdue.join(", ")}. Check ${CPUC_PAGE_URL}`
      : "",
    unchecked.length > 0 ? `(Could not check CPUC: ${unchecked.join("; ")}.)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const escalate = ingestFailing.length > 0 || overdue.length > 0;
  await notifySlack(summary, escalate ? "warn" : "info");

  return NextResponse.json({
    ok: true,
    quartersInDb: present.size,
    ingestFailing,
    pending: missing,
    overdue,
    unchecked,
  });
}
