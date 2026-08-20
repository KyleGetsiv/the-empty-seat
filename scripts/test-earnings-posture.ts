// scripts/test-earnings-posture.ts
// Offline tests for the disclosure-posture matrix (4.6b). Pure functions.
// Run with: npx tsx scripts/test-earnings-posture.ts

import { strict as assert } from "assert";
import {
  registerOf,
  buildPostureMatrix,
  shadeStep,
  maxCellCount,
  REGISTER_OF,
  REGISTER_ORDER,
} from "@/lib/earnings-posture";
import { MENTION_TYPES } from "@/lib/earnings-mentions";
import type { PublicEarningsEvent, PublicMention } from "@/lib/earnings-types";

let failures = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok    ${name}`))
    .catch((err) => {
      failures++;
      console.error(`FAIL  ${name}\n      ${err instanceof Error ? err.message : err}`);
    });
}

let seq = 0;
function m(mentionType: string): PublicMention {
  return {
    id: `m${seq++}`,
    mentionType,
    quoteText: "q",
    speaker: null,
    confidence: "high",
    annotation: null,
    metricSlug: null,
    metricValue: null,
    metricUnit: null,
    metricPeriod: null,
    promoted: false,
    locator: null,
  };
}

function e(fiscalPeriod: string, mentions: PublicMention[] = []): PublicEarningsEvent {
  return {
    id: `e${seq++}`,
    slug: "s",
    companySlug: "alphabet",
    fiscalPeriod,
    eventType: "10-Q",
    filerName: "Alphabet",
    subjectName: "Waymo",
    eventDate: "2026-01-01",
    processingStatus: "reviewed",
    reviewComplete: true,
    extractionChunks: 2,
    extractionModel: "claude-sonnet-5",
    extractionVersion: 1,
    sourceUrl: null,
    sourceTitle: null,
    sourcePublisher: null,
    mentions,
    presence: mentions.length > 0 ? "has_mentions" : "no_approved_mentions",
  };
}

async function main() {
  // If a new mention_type ships without a register, it silently becomes
  // "other" and disappears into an unlabelled row. This is the guard.
  await test("every mention type in the vocabulary has an explicit register", () => {
    const missing = (MENTION_TYPES as readonly string[]).filter((t) => !(t in REGISTER_OF));
    assert.deepEqual(missing, [], `unmapped mention types: ${missing.join(", ")}`);
  });

  await test("an unknown type falls back to other rather than throwing", () => {
    assert.equal(registerOf("some_future_type"), "other");
  });

  await test("quarters run oldest first so the matrix reads as time", () => {
    const mx = buildPostureMatrix([e("Q3 2025"), e("Q1 2026"), e("Q4 2025")]);
    assert.deepEqual(mx.quarters.map((q) => q.key), ["Q3 2025", "Q4 2025", "Q1 2026"]);
  });

  await test("a 10-K shares its quarter's column and marks the label", () => {
    const mx = buildPostureMatrix([e("Q4 2025"), e("FY 2025")]);
    assert.equal(mx.quarters.length, 1);
    assert.equal(mx.quarters[0].documents, 2);
    assert.equal(mx.quarters[0].label, "Q4 2025 and full year");
  });

  await test("a quarter with documents but no approved mentions still gets a column", () => {
    const mx = buildPostureMatrix([e("Q2 2026"), e("Q1 2026", [m("strategic_commentary")])]);
    assert.equal(mx.quarters.length, 2);
    const q2 = mx.quarters.find((q) => q.key === "Q2 2026")!;
    assert.equal(q2.documents, 1);
    assert.equal(q2.total, 0);
    assert.deepEqual(mx.silentQuarters.map((q) => q.key), ["Q2 2026"]);
  });

  await test("mentions land in the right register and totals reconcile", () => {
    const mx = buildPostureMatrix([
      e("Q1 2026", [
        m("ride_count"),
        m("revenue_reference"),
        m("strategic_commentary"),
        m("forward_guidance"),
        m("safety_reference"),
        m("other"),
      ]),
    ]);
    const total = (r: string) => mx.rows.find((x) => x.register === r)!.total;
    assert.equal(total("quantified"), 2);
    assert.equal(total("strategy"), 2);
    assert.equal(total("positioning"), 1);
    assert.equal(total("other"), 1);
    assert.equal(mx.grandTotal, 6);
    assert.equal(
      mx.rows.reduce((n, r) => n + r.total, 0),
      mx.grandTotal,
      "row totals must reconcile with the grand total"
    );
  });

  await test("per-type counts survive the collapse to four registers", () => {
    const mx = buildPostureMatrix([e("Q1 2026", [m("ride_count"), m("ride_count"), m("capex")])]);
    const cell = mx.rows.find((r) => r.register === "quantified")!.cells[0];
    assert.equal(cell.count, 3);
    assert.deepEqual(cell.byType, [
      { type: "ride_count", count: 2 },
      { type: "capex", count: 1 },
    ]);
  });

  await test("peak and dominant read from the data", () => {
    const mx = buildPostureMatrix([
      e("Q1 2026", [m("strategic_commentary"), m("strategic_commentary")]),
      e("Q2 2026", [m("strategic_commentary")]),
    ]);
    assert.equal(mx.peak?.key, "Q1 2026");
    assert.equal(mx.dominant?.register, "strategy");
  });

  await test("an empty corpus reports nothing rather than a false peak", () => {
    const mx = buildPostureMatrix([]);
    assert.equal(mx.grandTotal, 0);
    assert.equal(mx.peak, null);
    assert.equal(mx.dominant, null);
    assert.equal(mx.rows.length, REGISTER_ORDER.length);
  });

  await test("a corpus of only silent documents reports no peak", () => {
    const mx = buildPostureMatrix([e("Q1 2026"), e("Q2 2026")]);
    assert.equal(mx.peak, null);
    assert.equal(mx.silentQuarters.length, 2);
  });

  // An empty cell must never render as faint shading: on this site a blank
  // cell is a claim, and a faint one would blur it into a small count.
  await test("zero shades to zero and the busiest cell shades to full", () => {
    assert.equal(shadeStep(0, 12), 0);
    assert.equal(shadeStep(12, 12), 4);
    assert.equal(shadeStep(1, 12), 1);
    assert.equal(shadeStep(5, 0), 0);
  });

  await test("maxCellCount finds the busiest single cell, not the busiest quarter", () => {
    const mx = buildPostureMatrix([
      e("Q1 2026", [m("strategic_commentary"), m("strategic_commentary"), m("ride_count")]),
    ]);
    assert.equal(maxCellCount(mx), 2);
  });

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll earnings posture tests passed");
}
main();
