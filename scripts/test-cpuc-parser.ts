// scripts/test-cpuc-parser.ts
// Fixture-based tests for the CPUC scraper's parsing and calendar logic.
// No test framework (per testing expectations: lightweight, fixture-driven,
// no live network in CI). The fixture is the real Driverless AV_Month CSV
// from CPUC's Q1 2026 Waymo deployment report.
//
// Exercises the full zip path: the fixture CSV is zipped in-memory with the
// same directory layout CPUC uses, then run through extractFromZip,
// parseMonthCsv, and aggregateQuarter.
//
// Run with: npx tsx scripts/test-cpuc-parser.ts

import { readFileSync } from "fs";
import { resolve } from "path";
import { strict as assert } from "assert";
import { zipSync, strToU8 } from "fflate";
import {
  parseCsvLine,
  parseMonthCsv,
  aggregateQuarter,
  extractFromZip,
  deploymentZipUrl,
} from "@/lib/scrapers/cpuc";
import {
  filingDeadline,
  isOverdue,
  expectedQuarters,
  quarterDateRange,
  quarterLabel,
  parseQuarterLabel,
  nextQuarter,
  filingDeadlineLabel,
} from "@/lib/cpuc-calendar";

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${name}`);
    console.error(`      ${err instanceof Error ? err.message : err}`);
  }
}

const fixtureCsv = readFileSync(
  resolve(process.cwd(), "lib/scrapers/__fixtures__/cpuc-av-month-driverless-2026q1.csv"),
  "utf8"
);

// Known-correct totals for the fixture (hand-checked against the raw CSV).
const Q1_2026_TRIPS = 1_322_645 + 1_220_222 + 1_363_067; // 3,905,934
const Q1_2026_VMT = 9_092_739.36 + 8_191_719.64 + 9_105_108.29; // 26,389,567.29

test("parseCsvLine handles quoted thousands separators", () => {
  const cells = parseCsvLine('PSG0038152,2026,1,"1,322,645","414,292",0');
  assert.deepEqual(cells, ["PSG0038152", "2026", "1", "1,322,645", "414,292", "0"]);
});

test("parseCsvLine handles escaped quotes", () => {
  assert.deepEqual(parseCsvLine('a,"b""c",d'), ["a", 'b"c', "d"]);
});

test("parseMonthCsv parses the real Q1 2026 fixture", () => {
  const rows = parseMonthCsv(fixtureCsv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].year, 2026);
  assert.equal(rows[0].month, 1);
  assert.equal(rows[0].totalTrips, 1_322_645);
  assert.ok(Math.abs(rows[2].totalVmtZev - 9_105_108.29) < 0.01);
});

test("parseMonthCsv is column-order independent", () => {
  const reordered =
    "Month,TotalVMTZEV,Year,TotalTrips\n" + '2,"100.50",2026,"1,000"\n';
  const rows = parseMonthCsv(reordered);
  assert.equal(rows[0].month, 2);
  assert.equal(rows[0].totalTrips, 1000);
  assert.ok(Math.abs(rows[0].totalVmtZev - 100.5) < 0.001);
});

test("aggregateQuarter sums Q1 2026 correctly", () => {
  const totals = aggregateQuarter(parseMonthCsv(fixtureCsv), { year: 2026, q: 1 });
  assert.equal(totals.monthsFound, 3);
  assert.equal(totals.totalTrips, Q1_2026_TRIPS);
  assert.ok(Math.abs(totals.totalVmtZev - Q1_2026_VMT) < 0.01);
});

test("aggregateQuarter reports partial filings", () => {
  const twoMonths = parseMonthCsv(fixtureCsv).slice(0, 2);
  const totals = aggregateQuarter(twoMonths, { year: 2026, q: 1 });
  assert.equal(totals.monthsFound, 2);
});

test("aggregateQuarter excludes other quarters and years", () => {
  const totals = aggregateQuarter(parseMonthCsv(fixtureCsv), { year: 2026, q: 2 });
  assert.equal(totals.monthsFound, 0);
  assert.equal(totals.totalTrips, 0);
});

test("extractFromZip finds the Driverless month CSV in CPUC's layout", () => {
  const zip = zipSync({
    "Waymo Deployment 2026Q1/Driverless/PSG0038152_2026_05_AV_Month_Part0-Deployment-Public.csv":
      strToU8(fixtureCsv),
    "Waymo Deployment 2026Q1/Drivered/PSG0038152_2026_05_AV_Month_Part0.csv":
      strToU8("TCPID,Year,Month,TotalTrips,TotalVMTZEV\n"),
    "Waymo Deployment 2026Q1/Driverless/PSG0038152_2026_05_AV_Incidents_Complaints_Part0.csv":
      strToU8("a,b\n1,2\n"),
  });
  const { monthCsv, archivable } = extractFromZip(zip);
  const totals = aggregateQuarter(parseMonthCsv(monthCsv), { year: 2026, q: 1 });
  assert.equal(totals.totalTrips, Q1_2026_TRIPS);
  assert.equal(archivable.length, 3);
});

test("extractFromZip throws when no Driverless month CSV exists", () => {
  const zip = zipSync({ "whatever/readme.csv": strToU8("a\n1\n") });
  assert.throws(() => extractFromZip(zip), /No Driverless AV_Month CSV/);
});

test("filing deadlines follow the CPUC calendar", () => {
  assert.equal(filingDeadline({ year: 2026, q: 1 }).toISOString().slice(0, 10), "2026-05-01");
  assert.equal(filingDeadline({ year: 2026, q: 2 }).toISOString().slice(0, 10), "2026-08-01");
  assert.equal(filingDeadline({ year: 2026, q: 3 }).toISOString().slice(0, 10), "2026-11-01");
  assert.equal(filingDeadline({ year: 2026, q: 4 }).toISOString().slice(0, 10), "2027-02-01");
});

test("overdue logic respects the grace period", () => {
  const q2 = { year: 2026, q: 2 as const };
  // Aug 15, 2026: two weeks past the Aug 1 deadline, inside 42-day grace.
  assert.equal(isOverdue(q2, new Date("2026-08-15T00:00:00Z")), false);
  // Sep 20, 2026: past deadline plus grace.
  assert.equal(isOverdue(q2, new Date("2026-09-20T00:00:00Z")), true);
});

test("expectedQuarters spans pattern start through the current deadline", () => {
  const qs = expectedQuarters(new Date("2026-08-15T00:00:00Z"));
  const labels = qs.map(quarterLabel);
  assert.deepEqual(labels, ["Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"]);
});

test("quarter date ranges are correct across year boundaries", () => {
  assert.deepEqual(quarterDateRange({ year: 2025, q: 4 }), {
    period_start: "2025-10-01",
    period_end: "2025-12-31",
  });
  assert.deepEqual(quarterDateRange({ year: 2026, q: 1 }), {
    period_start: "2026-01-01",
    period_end: "2026-03-31",
  });
});

test("zip URLs follow the stable pattern", () => {
  assert.ok(
    deploymentZipUrl({ year: 2026, q: 1 }).endsWith("/waymo-deployment-2026q1.zip")
  );
});

test("quarter label round-trips and advances", () => {
  const qt = parseQuarterLabel("Q4 2025");
  assert.ok(qt);
  assert.deepEqual(nextQuarter(qt!), { year: 2026, q: 1 });
  assert.equal(quarterLabel(nextQuarter(qt!)), "Q1 2026");
  assert.equal(parseQuarterLabel("garbage"), null);
  assert.equal(filingDeadlineLabel({ year: 2026, q: 2 }), "August 1, 2026");
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll tests passed");
