// scripts/test-promotion.ts
// Offline tests for metric promotion's decision logic (fix(4.5)). Pure
// functions only, no Supabase and no network, matching the style of
// scripts/test-extraction.ts. Run with: npx tsx scripts/test-promotion.ts
//
// The cases below are the three real defects found when the 4.5 review pass
// was spot-checked on 2026-08-16, written as regressions:
//   - a figure reaffirmed on a later call filed a duplicate row
//   - a row was left behind when a mention stopped being a metric mention
//   - a raw mention UUID was written into a publicly visible notes field

import { strict as assert } from "assert";
import {
  decidePromotion,
  appendReaffirmation,
  reaffirmationNote,
  firstDisclosureNote,
  isSameScope,
  insertPayload,
  PROMOTION_SCOPE,
  type PromotionContext,
  type CandidateRow,
} from "@/lib/earnings-promote";

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

const q1_2026: PromotionContext = {
  subjectId: "waymo-id",
  eventDate: "2026-04-29",
  eventType: "earnings_call",
  fiscalPeriod: "Q1 2026",
  sourceId: "source-id",
};

const q4_2025: PromotionContext = {
  subjectId: "waymo-id",
  eventDate: "2026-02-04",
  eventType: "earnings_call",
  fiscalPeriod: "Q4 2025",
  sourceId: "source-id",
};

function row(over: Partial<CandidateRow> = {}): CandidateRow {
  return { id: "row-1", as_of: "2026-03-26", scope: PROMOTION_SCOPE, notes: null, ...over };
}

async function main() {

await test("a figure nobody has disclosed yet inserts a new row", () => {
  const d = decidePromotion([], q1_2026, "ride_count", 500000);
  assert.equal(d.kind, "insert");
});

await test("a figure reaffirmed on a later call links instead of duplicating", () => {
  // The exact 500,000 case: hand-seeded 2026-03-26, restated on the Q1 2026
  // call 2026-04-29. Pre-fix this inserted a second row and put a flat
  // doubled step on the public chart.
  const d = decidePromotion([row({ as_of: "2026-03-26" })], q1_2026, "ride_count", 500000);
  assert.equal(d.kind, "link");
  if (d.kind !== "link") return;
  assert.equal(d.rowId, "row-1");
  assert.equal(d.redateTo, undefined);
});

await test("an earlier statement re-dates a row created by a later event", () => {
  // Backfills do not run in chronological order, so the first row written for
  // a figure is not necessarily the first time it was said.
  const d = decidePromotion([row({ as_of: "2026-04-29" })], q4_2025, "ride_count", 400000);
  assert.equal(d.kind, "link");
  if (d.kind !== "link") return;
  assert.equal(d.redateTo, "2026-02-04");
});

await test("the earliest of several existing rows wins", () => {
  const d = decidePromotion(
    [row({ id: "late", as_of: "2026-04-29" }), row({ id: "early", as_of: "2026-03-26" })],
    q1_2026,
    "ride_count",
    500000
  );
  assert.equal(d.kind, "link");
  if (d.kind !== "link") return;
  assert.equal(d.rowId, "early");
});

await test("a hand-seeded row with no scope still counts as the same figure", () => {
  // The 2.3 seed rows are the originals the pipeline should link to, and some
  // left scope null. Excluding them would recreate the duplicate problem.
  assert.equal(isSameScope(row({ scope: null })), true);
  const d = decidePromotion([row({ scope: null })], q1_2026, "ride_count", 500000);
  assert.equal(d.kind, "link");
});

await test("a different scope is a different figure, not a restatement", () => {
  assert.equal(isSameScope(row({ scope: "california" })), false);
  const d = decidePromotion([row({ scope: "california" })], q1_2026, "ride_count", 500000);
  assert.equal(d.kind, "insert");
});

await test("a non-promoting mention type promotes nothing", () => {
  // revenue_reference and strategic_commentary carry numbers but have no
  // disclosed_metrics slug, so they must never reach the table.
  assert.equal(decidePromotion([], q1_2026, "revenue_reference", 411000000).kind, "none");
  assert.equal(decidePromotion([], q1_2026, "strategic_commentary", 500000).kind, "none");
});

await test("a missing or non-positive number promotes nothing", () => {
  assert.equal(decidePromotion([], q1_2026, "ride_count", 0).kind, "none");
  assert.equal(decidePromotion([], q1_2026, "ride_count", -5).kind, "none");
  assert.equal(decidePromotion([], q1_2026, "ride_count", NaN).kind, "none");
});

await test("no context promotes nothing", () => {
  assert.equal(decidePromotion([], null, "ride_count", 500000).kind, "none");
});

await test("appending a reaffirmation is idempotent", () => {
  // Re-approving a mention, or re-running the backfill, must not grow notes.
  const first = appendReaffirmation(null, q1_2026);
  assert.equal(first, reaffirmationNote(q1_2026));
  const second = appendReaffirmation(first, q1_2026);
  assert.equal(second, first);
  const third = appendReaffirmation(second, q1_2026);
  assert.equal(third, first);
});

await test("a reaffirmation preserves the hand-written note it is added to", () => {
  const seeded = "500,000 paid rides weekly across 10 US cities.";
  const after = appendReaffirmation(seeded, q1_2026);
  assert.ok(after.startsWith(seeded));
  assert.ok(after.includes("Q1 2026"));
});

await test("two different events both leave their mark", () => {
  const after = appendReaffirmation(appendReaffirmation(null, q4_2025), q1_2026);
  assert.ok(after.includes("Q4 2025"));
  assert.ok(after.includes("Q1 2026"));
});

await test("notes never carry an internal id", () => {
  // disclosed_metrics.notes can surface in the public <Metric> tooltip. The
  // pre-fix version wrote "mention <uuid>" into it.
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  assert.ok(!uuid.test(firstDisclosureNote(q1_2026)));
  assert.ok(!uuid.test(reaffirmationNote(q1_2026)));
  assert.ok(!/mention/i.test(firstDisclosureNote(q1_2026)));
});

await test("an inserted row is company-attributed and carries its source", () => {
  const payload = insertPayload(q1_2026, "weekly_rides", 500000);
  assert.equal(payload.attribution, "company");
  assert.equal(payload.source_id, "source-id");
  assert.equal(payload.as_of, "2026-04-29");
  assert.equal(payload.scope, PROMOTION_SCOPE);
  assert.equal(payload.stated_by, "earnings call, Q1 2026");
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll promotion tests passed");
}
main();
