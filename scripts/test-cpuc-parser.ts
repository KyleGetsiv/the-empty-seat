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

// ---------------------------------------------------------------------------
// Module 3.4: pilot-program xlsx path. Builds a minimal xlsx in memory with
// the same structure Zoox files (workbook.xml with named sheets, rels,
// sharedStrings, a Month-Level sheet with the CPUC template columns), then
// runs it through readXlsxSheet and extractPilotMonthCsv. Values are Zoox's
// real Q1 2026 driverless month-level figures.
// ---------------------------------------------------------------------------

import { zipSync as zipSync2, strToU8 as s2u } from "fflate";
import { readXlsxSheet, rowsToCsv } from "@/lib/scrapers/cpuc-xlsx";
import { extractPilotMonthCsv, PILOT_CARRIERS } from "@/lib/scrapers/cpuc";

function buildXlsx(): Uint8Array {
  const header = ["TCPID","Year","Month","TotalTrips","TotalWaiting","TotalVMTPeriod1","TotalVMTPeriod2","TotalVMTPeriod3","TotalVMTZEV","TotalPassengersCarried","TotalPMT"];
  const shared = ["Cover", ...header, "0038380-P"];
  const sIdx = (v: string) => shared.indexOf(v);
  const cols = "ABCDEFGHIJK";
  const rowsData: (string | number)[][] = [
    header,
    ["0038380-P", 2026, 1, 5219, 89.33, 19492.63, 4108.11, 8396.2, 31996.94, 6304, 10075.03],
    ["0038380-P", 2026, 2, 7164, 117.78, 21179.29, 5453.89, 11533.02, 38162.55, 8482, 13511.97],
    ["0038380-P", 2026, 3, 10685, 245.06, 25296.47, 8515.89, 17325.36, 51137.72, 12731, 20407.4],
  ];
  const sheetRows = rowsData
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          const ref = `${cols[ci]}${ri + 1}`;
          if (typeof v === "string") return `<c r="${ref}" t="s"><v>${sIdx(v)}</v></c>`;
          return `<c r="${ref}"><v>${v}</v></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const monthSheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const coverSheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`;
  const workbook = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cover" sheetId="1" r:id="rId5"/><sheet name="Trip-Level" sheetId="2" r:id="rId6"/><sheet name="Month-Level" sheetId="3" r:id="rId7"/></sheets></workbook>`;
  const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId6" Type="x" Target="worksheets/sheet2.xml"/><Relationship Id="rId7" Type="x" Target="worksheets/sheet3.xml"/></Relationships>`;
  const sst = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared.map((t) => `<si><t>${t}</t></si>`).join("")}</sst>`;
  return zipSync2({
    "xl/workbook.xml": s2u(workbook),
    "xl/_rels/workbook.xml.rels": s2u(rels),
    "xl/sharedStrings.xml": s2u(sst),
    "xl/worksheets/sheet1.xml": s2u(coverSheet),
    "xl/worksheets/sheet2.xml": s2u(coverSheet),
    "xl/worksheets/sheet3.xml": s2u(monthSheet),
  });
}

const ZOOX_Q1_TRIPS = 5219 + 7164 + 10685; // 23,068
const ZOOX_Q1_VMT = 31996.94 + 38162.55 + 51137.72; // 121,297.21

test("readXlsxSheet finds Month-Level by name and resolves shared strings", () => {
  const rows = readXlsxSheet(buildXlsx(), "Month-Level");
  assert.equal(rows[0][0], "TCPID");
  assert.equal(rows[0][3], "TotalTrips");
  assert.equal(rows[1][0], "0038380-P");
  assert.equal(rows[1][3], "5219");
  assert.equal(rows.length, 4);
});

test("readXlsxSheet errors clearly on a missing sheet", () => {
  assert.throws(() => readXlsxSheet(buildXlsx(), "Nope"), /not found; sheets: Cover, Trip-Level, Month-Level/);
});

test("xlsx month sheet round-trips through rowsToCsv and parseMonthCsv", () => {
  const csv = rowsToCsv(readXlsxSheet(buildXlsx(), "Month-Level"));
  const totals = aggregateQuarter(parseMonthCsv(csv), { year: 2026, q: 1 });
  assert.equal(totals.monthsFound, 3);
  assert.equal(totals.totalTrips, ZOOX_Q1_TRIPS);
  assert.ok(Math.abs(totals.totalVmtZev - ZOOX_Q1_VMT) < 0.01);
});

test("extractPilotMonthCsv reads Zoox xlsx from the pilot zip layout", () => {
  const zip = zipSync2({
    "AV Pilot 2026Q1/Zoox/(PUBLIC) 2026-05-01 Zoox Q1 2026 CPUC Quarterly Report - Data Tables Driverless.xlsx": buildXlsx(),
    "AV Pilot 2026Q1/Zoox/(PUBLIC) 2026-05-01 Zoox Q1 2026 CPUC Quarterly Report - Data Tables Drivered.xlsx": buildXlsx(),
    "AV Pilot 2026Q1/Zoox/2026-05-01 Zoox Q1 2026 CPUC Quarterly Report - Cover Letter.pdf": s2u("%PDF"),
    "AV Pilot 2026Q1/Waymo/Driverless Pilot/PSG0038152_2026_05_AV_Month_Part0.csv": s2u("TCPID,Year,Month,TotalTrips,TotalVMTZEV\nx,2026,1,1,1\n"),
  });
  const zoox = PILOT_CARRIERS.find((c) => c.folder === "Zoox")!;
  const out = extractPilotMonthCsv(zip, zoox);
  assert.ok(out, "expected extraction");
  const totals = aggregateQuarter(parseMonthCsv(out!.monthCsv), { year: 2026, q: 1 });
  assert.equal(totals.totalTrips, ZOOX_Q1_TRIPS);
  // PDFs excluded, extracted CSV always archived
  assert.ok(out!.archivable.some((f) => f.name.endsWith("month-level-extracted.csv")));
  assert.ok(!out!.archivable.some((f) => /\.pdf$/i.test(f.name)));
});

test("extractPilotMonthCsv prefers CSV template when a carrier files CSVs", () => {
  const csv = "TCPID,Year,Month,TotalTrips,TotalVMTZEV\nN,2026,4,100,10\nN,2026,5,200,20\nN,2026,6,300,30\n";
  const zip = zipSync2({
    "AV Pilot 2026Q2/Nuro/Driverless Pilot/TCP47827_2026_08_AV_Month_Part0.csv": s2u(csv),
  });
  const nuro = PILOT_CARRIERS.find((c) => c.folder === "Nuro")!;
  const out = extractPilotMonthCsv(zip, nuro);
  assert.ok(out);
  const totals = aggregateQuarter(parseMonthCsv(out!.monthCsv), { year: 2026, q: 2 });
  assert.equal(totals.totalTrips, 600);
});

test("extractPilotMonthCsv returns null when the carrier folder is absent", () => {
  const zip = zipSync2({ "AV Pilot 2026Q1/Zoox/x.pdf": s2u("%PDF") });
  const nuro = PILOT_CARRIERS.find((c) => c.folder === "Nuro")!;
  assert.equal(extractPilotMonthCsv(zip, nuro), null);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed (pilot section)`);
  process.exit(1);
}
console.log("Pilot tests passed");
