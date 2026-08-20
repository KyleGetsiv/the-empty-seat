// scripts/audit-promotion-mapping.ts
// Module 4.12. Reports how the new promotion mapping differs from the old one
// across every reviewed mention. READ ONLY: it writes nothing, by design.
//
//   npx tsx scripts/audit-promotion-mapping.ts
//   npx tsx scripts/audit-promotion-mapping.ts --all   # include unchanged rows
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//
// Why it does not auto-correct: every row here reflects a human approval
// decision, and a promotion change that silently rewrites published figures
// under a named executive's quote is exactly the failure fix(4.5) already had
// to clean up once. The diff gets reviewed, then corrected by hand or by a
// separate script with the diff in front of you.
//
// Why the ALREADY PROMOTED section cannot be re-derived. Before 4.12 the
// approve path overwrote extracted_metric with a mention_type-derived slug, a
// null unit and the event's fiscal period. For any mention that actually
// promoted, the model's original reading was destroyed on approval, so the
// column now holds the OLD mapping's answer. Comparing against it would
// compare the old mapping with itself and report agreement, which is worse
// than reporting nothing: it would look like a clean bill of health. Those
// rows are listed for manual checking rather than silently passed.

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  resolvePromotionSlug,
  METRIC_PROMOTION,
  metricLabel,
} from "@/lib/earnings-mentions";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // env vars may already be set in the shell
}

const showAll = process.argv.includes("--all");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient<Database>(url, key);

interface MetricJson {
  metric?: string;
  value?: number;
  unit?: string | null;
  period?: string | null;
}

function oldSlug(mentionType: string): string | null {
  return METRIC_PROMOTION[mentionType] ?? null;
}

function short(text: string, max = 120): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 3)}...`;
}

async function main() {
  const { data, error } = await db
    .from("waymo_mentions")
    .select(
      "id, mention_type, quote_text, speaker, review_status, extracted_metric, disclosed_metric_id, earnings_events(fiscal_period, event_type, event_date)"
    )
    .in("review_status", ["approved", "pending"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Read failed:", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  const changed: string[] = [];
  const unreliable: string[] = [];
  const unchanged: string[] = [];

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const em = (r.extracted_metric ?? null) as MetricJson | null;
    const mentionType = r.mention_type as string;
    const event = (r.earnings_events ?? null) as {
      fiscal_period: string;
      event_type: string;
      event_date: string;
    } | null;
    const where = event ? `${event.fiscal_period} ${event.event_type}` : "unknown event";

    const before = oldSlug(mentionType);
    const after = resolvePromotionSlug(em?.metric, mentionType);

    const line = [
      `  ${where}  [${mentionType}]  ${String(r.review_status).toUpperCase()}${
        r.speaker ? `  ${r.speaker}` : ""
      }`,
      `    was: ${before ? metricLabel(before) : "nothing"}   now: ${after ? metricLabel(after) : "nothing"}`,
      `    model read: ${em?.metric ?? "no slug"}   value: ${em?.value ?? "none"}`,
      `    "${short(r.quote_text as string)}"`,
      `    mention ${r.id}`,
    ].join("\n");

    // A promoted row's extracted_metric was overwritten on approval, so its
    // model slug is not the model's. Cannot be re-derived; flag for a human.
    if (r.disclosed_metric_id) {
      unreliable.push(
        `${line}\n    NOTE: already promoted, so extracted_metric was overwritten on approval. Verify by reading the quote.`
      );
      continue;
    }
    if (before !== after) changed.push(line);
    else unchanged.push(line);
  }

  console.log("PROMOTION MAPPING AUDIT (4.12)");
  console.log(`Read ${rows.length} approved or pending mentions. Nothing was written.\n`);

  console.log(`CHANGED BY THE NEW MAPPING: ${changed.length}`);
  console.log("These are not yet promoted, so extracted_metric is intact and the diff is real.");
  console.log("APPROVED rows publish the 'now' slug only if you approve them again.");
  console.log("PENDING rows publish it on their next approve, INCLUDING via bulk approve,");
  console.log("so a pending row you do not want published needs an explicit decision.\n");
  console.log(changed.length ? changed.join("\n\n") : "  (none)");

  console.log(`\n\nCANNOT BE RE-DERIVED: ${unreliable.length}`);
  console.log("Already promoted, so the stored reading is the old mapping's, not the model's.");
  console.log("Check each against its quote by hand. This is the fix(4.5) spot-check set.\n");
  console.log(unreliable.length ? unreliable.join("\n\n") : "  (none)");

  console.log(`\n\nUNCHANGED: ${unchanged.length}`);
  if (showAll && unchanged.length) console.log(`\n${unchanged.join("\n\n")}`);
  else console.log("Re-run with --all to list them.");

  console.log("\nNothing was written. Correct anything above through the review queue.");
}

main();
