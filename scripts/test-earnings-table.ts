// scripts/test-earnings-table.ts
// Offline tests for reading back the annotateTableRows prefix (4.6a).
// Pure functions, no Supabase and no network.
// Run with: npx tsx scripts/test-earnings-table.ts
//
// The first two cases are the exact strings that shipped to the browser as
// pseudo-quotations on the Q2 2026 10-Q permalink and prompted this fix.

import { strict as assert } from "assert";
import {
  parseTableReading,
  isTableReading,
  readingLabel,
} from "@/lib/earnings-table";

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

const REVENUE_ROW =
  "[Three Months Ended Six Months Ended | Revenues:] Other Bets 373 382 823 793";
const LOSS_ROW =
  "[Three Months Ended Six Months Ended | Operating income (loss):] Other Bets ( 1,246 ) ( 1,799 ) ( 2,472 ) ( 3,899 )";

async function main() {
  await test("the revenue row splits into columns, section, label, and cells", () => {
    const r = parseTableReading(REVENUE_ROW);
    assert.ok(r);
    assert.equal(r.columns, "Three Months Ended Six Months Ended");
    assert.equal(r.section, "Revenues:");
    assert.equal(r.rowLabel, "Other Bets");
    assert.deepEqual(r.values, ["373", "382", "823", "793"]);
  });

  await test("parenthesized negatives regroup into single cells", () => {
    const r = parseTableReading(LOSS_ROW);
    assert.ok(r);
    assert.deepEqual(r.values, ["(1,246)", "(1,799)", "(2,472)", "(3,899)"]);
  });

  await test("a section label containing parentheses stays with the section", () => {
    const r = parseTableReading(LOSS_ROW);
    assert.ok(r);
    assert.equal(r.section, "Operating income (loss):");
    assert.equal(r.rowLabel, "Other Bets");
  });

  await test("the raw row is preserved unmodified for the audit line", () => {
    assert.equal(parseTableReading(LOSS_ROW)?.raw, LOSS_ROW);
  });

  await test("a real sentence is not a table reading", () => {
    const prose =
      "Revenues from Other Bets are generated primarily from the sale of autonomous transportation services and internet services.";
    assert.equal(parseTableReading(prose), null);
    assert.equal(isTableReading(prose), false);
  });

  await test("a sentence that merely contains a bracket is not a table reading", () => {
    assert.equal(parseTableReading("We said [sic] that Waymo would scale."), null);
  });

  await test("a table with no section label still parses", () => {
    const r = parseTableReading("[Fleet as of December 31] Vehicles in service 1,500 2,500");
    assert.ok(r);
    assert.equal(r.section, null);
    assert.equal(r.rowLabel, "Vehicles in service");
    assert.deepEqual(r.values, ["1,500", "2,500"]);
  });

  await test("empty cells rendered as dashes survive as cells", () => {
    const r = parseTableReading("[Segment results | Revenues:] Other Bets -- 382");
    assert.ok(r);
    assert.equal(r.rowLabel, "Other Bets");
    assert.deepEqual(r.values, ["--", "382"]);
  });

  await test("currency and percent cells are cells, not part of the label", () => {
    const r = parseTableReading("[Margins | Operating margin:] Other Bets $382 12.5%");
    assert.ok(r);
    assert.equal(r.rowLabel, "Other Bets");
    assert.deepEqual(r.values, ["$382", "12.5%"]);
  });

  await test("a row with no numbers keeps its whole text as the label", () => {
    const r = parseTableReading("[Segment results | Revenues:] Other Bets");
    assert.ok(r);
    assert.equal(r.rowLabel, "Other Bets");
    assert.deepEqual(r.values, []);
  });

  await test("the reading label reads in document order without the colon", () => {
    assert.equal(readingLabel(parseTableReading(REVENUE_ROW)!), "Revenues, Other Bets");
    assert.equal(
      readingLabel(parseTableReading("[Fleet as of December 31] Vehicles in service 1,500")!),
      "Vehicles in service"
    );
  });

  // Degrade, never fabricate: if annotateTableRows changes its prefix shape,
  // parsing must fail rather than mis-split, so the mention renders as an
  // ordinary quote instead of as a wrong figure.
  await test("a malformed prefix parses to nothing rather than guessing", () => {
    assert.equal(parseTableReading("[unclosed prefix Other Bets 373 382"), null);
    assert.equal(parseTableReading("[] Other Bets 373"), null);
    assert.equal(parseTableReading("[Segment results]"), null);
  });

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll earnings table tests passed");
}
main();
