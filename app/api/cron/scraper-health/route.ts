import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/notify";

// Vercel Cron fires this daily at 09:00 UTC (configured in vercel.json).
// When scrapers exist, this will query their last successful run time and
// report any that are overdue. For now it is a placeholder that confirms
// the cron and notify pipeline are wired up correctly.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Placeholder: replace with real per-scraper health checks in Phase 1.3+
  await notifySlack("Scraper health check: no scrapers configured yet.", "info");

  return NextResponse.json({ ok: true });
}
