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
  const promotedClean: string[] = [];
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

    // A row promoted BEFORE 4.12 had its extracted_metric overwritten with
    // the mention_type slug, so its stored reading is not the model's. A row
    // promoted after keeps the model's reading and is trustworthy.
    //
    // They are told apart by what the overwrite would have written: it always
    // wrote METRIC_PROMOTION[mention_type], so a stored slug that DIFFERS
    // from that cannot be the overwrite's work. A stored slug that matches is
    // ambiguous (overwritten, or the model simply agreed), so it is flagged
    // rather than assumed either way.
    if (r.disclosed_metric_id) {
      const couldBeOverwritten = (em?.metric ?? null) === before;
      if (couldBeOverwritten) {
        unreliable.push(
          `${line}\n    NOTE: promoted under the old mapping, which overwrote extracted_metric. The stored reading may not be the model's. Verify against the quote.`
        );
      } else {
        promotedClean.push(
          `${line}\n    OK: the stored reading disagrees with the old mapping, so it survived intact. Promoted under 4.12.`
        );
      }
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
  console.log("Promoted under the old mapping, which overwrote extracted_metric, so the");
  console.log("stored reading may not be the model's. Check each against its quote by hand.\n");
  console.log(unreliable.length ? unreliable.join("\n\n") : "  (none)");

  console.log(`\n\nPROMOTED WITH THE MODEL'S READING INTACT: ${promotedClean.length}`);
  console.log("Promoted under 4.12. Nothing to check.\n");
  console.log(promotedClean.length ? promotedClean.join("\n\n") : "  (none)");

  console.log(`\n\nUNCHANGED: ${unchanged.length}`);
  if (showAll && unchanged.length) console.log(`\n${unchanged.join("\n\n")}`);
  else console.log("Re-run with --all to list them.");

  await reportDisclosedMetricHealth();

  console.log("\nNothing was written. Correct anything above through the review queue.");
}

// The failure promotion is meant to avoid is a second row for a figure that
// already exists. Checking the target table directly is cheaper than trusting
// that the matching logic behaved.
async function reportDisclosedMetricHealth() {
  const { data, error } = await db
    .from("disclosed_metrics")
    .select("id, metric, value, as_of, scope, attribution")
    .order("metric", { ascending: true })
    .order("as_of", { ascending: true });

  if (error) {
    console.log(`\n\nDISCLOSED_METRICS HEALTH: read failed (${error.message})`);
    return;
  }

  const rows = data ?? [];
  const byFigure = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.metric}|${r.value}`;
    byFigure.set(k, [...(byFigure.get(k) ?? []), r]);
  }
  const dupes = [...byFigure.entries()].filter(([, v]) => v.length > 1);
  const scopes = [...new Set(rows.map((r) => r.scope ?? "(null)"))].sort();

  console.log(`\n\nDISCLOSED_METRICS HEALTH: ${rows.length} rows`);
  console.log(`Scope labels in use: ${scopes.join(", ")}`);
  if (dupes.length === 0) {
    console.log("No duplicate (metric, value) pairs. Promotion linked rather than inserted.");
    return;
  }
  console.log(`DUPLICATE (metric, value) PAIRS: ${dupes.length}. Promotion may have inserted over a seed.`);
  for (const [k, v] of dupes) {
    console.log(`  ${k}`);
    for (const r of v) console.log(`    ${r.as_of}  scope=${r.scope ?? "null"}  ${r.attribution}  ${r.id}`);
  }
}

main();
