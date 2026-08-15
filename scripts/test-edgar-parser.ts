// scripts/test-edgar-parser.ts
// Fixture tests for the SEC EDGAR scraper's pure logic (module 4.2). The
// fixture is a trimmed copy of Alphabet's real submissions "recent" block
// as of 2026-08-15. No network.
// Run with: npx tsx scripts/test-edgar-parser.ts

import { readFileSync } from "fs";
import { resolve } from "path";
import { strict as assert } from "assert";
import {
  selectFilings,
  fiscalPeriodFor,
  eventTypeFor,
  pickPressReleaseExhibit,
  filingDocUrl,
  type SubmissionsRecent,
} from "@/lib/scrapers/sec-edgar";

let failures = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`ok    ${name}`); }
  catch (err) { failures++; console.error(`FAIL  ${name}\n      ${err instanceof Error ? err.message : err}`); }
}

const recent = JSON.parse(
  readFileSync(resolve(process.cwd(), "lib/scrapers/__fixtures__/edgar-submissions-recent-sample.json"), "utf8")
) as SubmissionsRecent;

test("selectFilings keeps 10-K, 10-Q, and earnings 8-Ks only", () => {
  const f = selectFilings(recent);
  const forms = f.map((x) => `${x.form}:${x.accession}`);
  // 8-K 8.01 (Aug 10) and 8-K 5.07 (Jun 5) must be excluded; 2.02 8-Ks kept.
  assert.deepEqual(forms, [
    "10-Q:0001652044-26-000071",
    "8-K:0001652044-26-000066",
    "10-Q:0001652044-26-000041",
    "8-K:0001652044-26-000038",
    "10-K:0001652044-26-000012",
  ]);
});

test("selectFilings honors --since", () => {
  const f = selectFilings(recent, { since: "2026-07-01" });
  assert.deepEqual(f.map((x) => x.accession), ["0001652044-26-000071", "0001652044-26-000066"]);
});

test("accession dash stripping and doc URL", () => {
  const f = selectFilings(recent).find((x) => x.accession === "0001652044-26-000066")!;
  assert.equal(f.accessionNoDash, "000165204426000066");
  assert.equal(
    filingDocUrl("1652044", f.accessionNoDash, f.primaryDocument),
    "https://www.sec.gov/Archives/edgar/data/1652044/000165204426000066/goog-20260722.htm"
  );
});

test("fiscal period labels: calendar quarters, FY for 10-K", () => {
  assert.equal(fiscalPeriodFor("10-Q", "2026-06-30"), "Q2 2026");
  assert.equal(fiscalPeriodFor("10-Q", "2026-03-31"), "Q1 2026");
  assert.equal(fiscalPeriodFor("10-K", "2025-12-31"), "FY 2025");
  // Earnings 8-K reportDate is the release date: July 22 release covers Q2;
  // Feb 4 release covers Q4 of the prior year.
  assert.equal(fiscalPeriodFor("8-K", "2026-07-22"), "Q2 2026");
  assert.equal(fiscalPeriodFor("8-K", "2026-04-29"), "Q1 2026");
  assert.equal(fiscalPeriodFor("8-K", "2026-02-04"), "Q4 2025");
});

test("eventTypeFor rejects untracked forms", () => {
  assert.equal(eventTypeFor("10-Q"), "10-Q");
  assert.throws(() => eventTypeFor("S-8"), /untracked/);
});

test("pickPressReleaseExhibit finds Alphabet-style and generic EX-99.1 names", () => {
  const alphabet = ["goog-20260722.htm","googexhibit991q22026.htm","R1.htm","FilingSummary.xml","report.css"];
  assert.equal(pickPressReleaseExhibit(alphabet), "googexhibit991q22026.htm");
  assert.equal(pickPressReleaseExhibit(["d8k.htm","ex99-1.htm","ex99-2.htm"]), "ex99-1.htm");
  assert.equal(pickPressReleaseExhibit(["d8k.htm","exhibit991.htm"]), "exhibit991.htm");
  assert.equal(pickPressReleaseExhibit(["d8k.htm","R1.htm"]), null);
});

if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log("\nAll EDGAR tests passed");
