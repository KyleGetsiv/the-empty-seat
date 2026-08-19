// scripts/fix-promoted-metrics.ts
// One-off correction (fix(4.5)) for the disclosed_metrics rows produced by the
// 4.5 review pass, found on 2026-08-16 when the promotions were spot-checked.
//
// Four defects, all from promotion having no concept of a restatement:
//
//  1. Three duplicate weekly_rides pairs. A figure reaffirmed on an earnings
//     call was filed as a brand-new disclosure dated to the call, days or
//     weeks after the original: 50,000 (2024-06-25 / 2024-07-23), 400,000
//     (2026-02-02 / 2026-02-04), 500,000 (2026-03-26 / 2026-04-29). These
//     render as flat doubled steps on the public DisclosedRidesChart.
//  2. cumulative_trips 4,000,000 @ 2025-02-05 is a full-year-2024 figure
//     ("safely serving more than 4 million passenger trips") mislabelled as
//     cumulative. It makes the cumulative series read 2M, 5M, 4M, 10M, 20M.
//     A hand-seeded note on the 2024-12-18 row already warned that this
//     wording differs in scope.
//  3. A mention quoting "more than 2 million trips to date" is linked to the
//     weekly_rides 50,000 row, so a cumulative sentence sources a weekly
//     figure under Pichai's name.
//  4. cities_count 11 @ 2026-04-29 is orphaned: its supporting mention was
//     re-typed and no approved mention cites it any more.
//
// Idempotent: every step is keyed on the row signature and is a no-op once
// applied. Dry run by default; pass --apply to write.
//   npx tsx scripts/fix-promoted-metrics.ts
//   npx tsx scripts/fix-promoted-metrics.ts --apply
//
// disclosed_metrics carries audit_trigger_fn, so every update and delete here
// lands in audit_log with full before/after jsonb and is reconstructible.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { appendReaffirmation, type PromotionContext } from "@/lib/earnings-promote";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // env vars may already be set in the shell
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let planned = 0;
let skipped = 0;
function plan(line: string) {
  planned++;
  console.log(`  ${APPLY ? "APPLY" : "PLAN "}  ${line}`);
}
function noop(line: string) {
  skipped++;
  console.log(`  ok     ${line}`);
}

// The duplicate pairs. keepAsOf is the original disclosure (hand-seeded in
// 2.3); dropAsOf is the reaffirmation the pipeline filed as new.
const DUPLICATE_PAIRS = [
  { metric: "weekly_rides", value: 50000, keepAsOf: "2024-06-25", dropAsOf: "2024-07-23" },
  { metric: "weekly_rides", value: 400000, keepAsOf: "2026-02-02", dropAsOf: "2026-02-04" },
  { metric: "weekly_rides", value: 500000, keepAsOf: "2026-03-26", dropAsOf: "2026-04-29" },
];

async function main() {
  const { data: waymo, error: companyError } = await client
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();
  if (companyError || !waymo) {
    console.error("Could not find Waymo company row:", companyError?.message);
    process.exit(1);
    return;
  }
  const waymoId = waymo.id;

  async function findRow(metric: string, value: number, asOf: string) {
    const { data } = await client
      .from("disclosed_metrics")
      .select("id, metric, value, as_of, notes")
      .eq("company_id", waymoId)
      .eq("metric", metric)
      .eq("value", value)
      .eq("as_of", asOf)
      .maybeSingle();
    return data;
  }

  console.log(`\n${APPLY ? "Applying" : "Dry run"} — fix(4.5) promoted metric corrections\n`);

  // --- 1. Collapse the duplicate pairs onto their originals ---------------
  console.log("1. Duplicate weekly_rides pairs");
  for (const pair of DUPLICATE_PAIRS) {
    const keep = await findRow(pair.metric, pair.value, pair.keepAsOf);
    const drop = await findRow(pair.metric, pair.value, pair.dropAsOf);
    const label = `${pair.metric} ${pair.value.toLocaleString()}`;

    if (!drop) {
      noop(`${label}: no duplicate at ${pair.dropAsOf}, already collapsed`);
      continue;
    }
    if (!keep) {
      console.error(`  SKIP   ${label}: no original at ${pair.keepAsOf}; refusing to delete the only copy`);
      continue;
    }

    const { data: citing } = await client
      .from("waymo_mentions")
      .select("id, earnings_event_id, extracted_metric, quote_text")
      .eq("disclosed_metric_id", drop.id);

    for (const mention of citing ?? []) {
      const { data: event } = await client
        .from("earnings_events")
        .select("event_date, event_type, fiscal_period")
        .eq("id", mention.earnings_event_id)
        .single();

      // Defect 3: a cumulative-trips quote must not end up citing a weekly
      // figure. It keeps its approval and its quote, and simply promotes
      // nothing: 'ride_count' maps only to weekly_rides, so there is no
      // honest slug for a to-date total on this mention.
      const em = mention.extracted_metric as { metric?: string } | null;
      if (em?.metric && em.metric !== pair.metric) {
        plan(`unlink mention citing "${(mention.quote_text ?? "").slice(0, 60)}..." (its figure is ${em.metric}, not ${pair.metric}), retype to 'other'`);
        if (APPLY) {
          await client
            .from("waymo_mentions")
            .update({ disclosed_metric_id: null, mention_type: "other" })
            .eq("id", mention.id);
        }
        continue;
      }

      plan(`relink mention on ${event?.fiscal_period} ${event?.event_type} from ${pair.dropAsOf} to the ${pair.keepAsOf} original`);
      if (APPLY) {
        await client.from("waymo_mentions").update({ disclosed_metric_id: keep.id }).eq("id", mention.id);
      }

      if (event) {
        const ctx: PromotionContext = {
          subjectId: waymoId,
          eventDate: event.event_date,
          eventType: event.event_type,
          fiscalPeriod: event.fiscal_period,
          sourceId: null,
        };
        const notes = appendReaffirmation(keep.notes, ctx);
        if (notes !== keep.notes) {
          plan(`note the reaffirmation on the ${pair.keepAsOf} row`);
          if (APPLY) await client.from("disclosed_metrics").update({ notes }).eq("id", keep.id);
          keep.notes = notes;
        }
      }
    }

    plan(`delete the duplicate ${label} row at ${pair.dropAsOf}`);
    if (APPLY) await client.from("disclosed_metrics").delete().eq("id", drop.id);
  }

  // --- 2. The mislabelled full-year figure --------------------------------
  console.log("\n2. cumulative_trips 4,000,000 @ 2025-02-05 (a full-year 2024 figure)");
  const fourMillion = await findRow("cumulative_trips", 4000000, "2025-02-05");
  if (!fourMillion) {
    noop("already removed");
  } else {
    const { data: citing } = await client
      .from("waymo_mentions")
      .select("id")
      .eq("disclosed_metric_id", fourMillion.id);
    for (const mention of citing ?? []) {
      plan("unlink its mention (the quote stays approved and still renders on /earnings)");
      if (APPLY) await client.from("waymo_mentions").update({ disclosed_metric_id: null }).eq("id", mention.id);
    }
    plan("delete the row: a 'trips during 2024' total is not a cumulative-to-date disclosure");
    if (APPLY) await client.from("disclosed_metrics").delete().eq("id", fourMillion.id);
  }

  // --- 3. The orphaned cities_count ---------------------------------------
  console.log("\n3. Orphaned cities_count 11 @ 2026-04-29");
  const orphan = await findRow("cities_count", 11, "2026-04-29");
  if (!orphan) {
    noop("already removed");
  } else {
    const { count } = await client
      .from("waymo_mentions")
      .select("id", { count: "exact", head: true })
      .eq("disclosed_metric_id", orphan.id)
      .eq("review_status", "approved");
    if ((count ?? 0) > 0) {
      noop(`still cited by ${count} approved mention(s); leaving it alone`);
    } else {
      plan("delete: no approved mention supports it");
      if (APPLY) await client.from("disclosed_metrics").delete().eq("id", orphan.id);
    }
  }

  // --- verification --------------------------------------------------------
  console.log("\n4. Verification");
  for (const metric of ["weekly_rides", "cumulative_trips"]) {
    const { data: series } = await client
      .from("disclosed_metrics")
      .select("value, as_of")
      .eq("company_id", waymoId)
      .eq("metric", metric)
      .order("as_of", { ascending: true });
    const rows = series ?? [];
    const duplicates = rows.filter((r, i) => i > 0 && r.value === rows[i - 1].value);
    const decreases = rows.filter((r, i) => i > 0 && Number(r.value) < Number(rows[i - 1].value));
    console.log(`  ${metric}: ${rows.length} rows, ${duplicates.length} repeated value(s), ${decreases.length} decrease(s)`);
    if (APPLY && duplicates.length > 0) console.log(`    still repeated: ${duplicates.map((d) => `${d.value} @ ${d.as_of}`).join(", ")}`);
    if (APPLY && decreases.length > 0) console.log(`    still decreasing: ${decreases.map((d) => `${d.value} @ ${d.as_of}`).join(", ")}`);
  }

  console.log(
    `\n${APPLY ? "Applied" : "Planned"} ${planned} change(s); ${skipped} already correct.` +
      (APPLY ? "" : "\nRe-run with --apply to write. Every change is logged to audit_log.\n")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
