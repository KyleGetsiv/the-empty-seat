// scripts/test-earnings-slug.ts
// Offline tests for permalink slug derivation and fiscal-period grouping
// (module 4.6a). Pure functions only, no Supabase and no network, matching
// the style of scripts/test-promotion.ts.
// Run with: npx tsx scripts/test-earnings-slug.ts

import { strict as assert } from "assert";
import {
  slugifyPart,
  eventSlug,
  findBySlug,
  periodGroupKey,
  periodGroupLabel,
  periodSortValue,
  isFullYearPeriod,
  type SluggableEvent,
} from "@/lib/earnings-slug";

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

const alphabet = (fiscalPeriod: string, eventType: string): SluggableEvent => ({
  companySlug: "alphabet",
  fiscalPeriod,
  eventType,
});

async function main() {
  await test("a quarterly call slugs to company, period, type", () => {
    assert.equal(eventSlug(alphabet("Q1 2026", "earnings_call")), "alphabet-q1-2026-earnings-call");
  });

  await test("a 10-K keeps its FY period and its hyphenated form", () => {
    assert.equal(eventSlug(alphabet("FY 2025", "10-K")), "alphabet-fy-2025-10-k");
  });

  await test("every event type produces a distinct slug within one period", () => {
    const types = ["10-K", "10-Q", "8-K", "earnings_call", "shareholder_letter", "investor_day", "press_release"];
    const slugs = types.map((t) => eventSlug(alphabet("Q4 2025", t)));
    assert.equal(new Set(slugs).size, types.length);
  });

  await test("slugs are url safe and carry no leading or trailing hyphen", () => {
    const s = slugifyPart("  FY 2025 (restated)  ");
    assert.equal(s, "fy-2025-restated");
    assert.ok(/^[a-z0-9-]+$/.test(s));
  });

  // The real corpus as of 4.6a: 13 quarters of Alphabet filings (one 8-K plus
  // one periodic report each) and 7 Motley Fool transcripts. If this ever
  // fails, the (period, type) uniqueness the permalink design rests on has
  // stopped holding.
  await test("the 33-event corpus shape produces 33 unique slugs", () => {
    const events: SluggableEvent[] = [];
    const quarters: Array<[number, number]> = [];
    for (let y = 2023; y <= 2026; y++) {
      for (let q = 1; q <= 4; q++) {
        if (y === 2023 && q < 2) continue;
        if (y === 2026 && q > 2) continue;
        quarters.push([y, q]);
      }
    }
    assert.equal(quarters.length, 13);
    for (const [y, q] of quarters) {
      events.push(alphabet(`Q${q} ${y}`, "8-K"));
      events.push(q === 4 ? alphabet(`FY ${y}`, "10-K") : alphabet(`Q${q} ${y}`, "10-Q"));
    }
    for (const [y, q] of [[2024, 1], [2024, 2], [2024, 4], [2025, 2], [2025, 3], [2025, 4], [2026, 1]] as Array<[number, number]>) {
      events.push(alphabet(`Q${q} ${y}`, "earnings_call"));
    }
    assert.equal(events.length, 33);
    assert.equal(new Set(events.map(eventSlug)).size, 33);
  });

  await test("resolution matches on the filer, not just period and type", () => {
    const events: SluggableEvent[] = [
      alphabet("Q1 2026", "earnings_call"),
      { companySlug: "pony-ai", fiscalPeriod: "Q1 2026", eventType: "earnings_call" },
    ];
    const hit = findBySlug(events, "pony-ai-q1-2026-earnings-call");
    assert.equal(hit.match?.companySlug, "pony-ai");
    assert.equal(hit.collisions.length, 0);
  });

  await test("an unknown slug resolves to nothing rather than the first row", () => {
    const hit = findBySlug([alphabet("Q1 2026", "8-K")], "alphabet-q9-1999-8-k");
    assert.equal(hit.match, null);
    assert.equal(hit.collisions.length, 0);
  });

  await test("a collision reports both rows instead of silently picking one", () => {
    const dup = [alphabet("FY 2025", "10-K"), alphabet("FY 2025", "10-K")];
    const hit = findBySlug(dup, "alphabet-fy-2025-10-k");
    assert.equal(hit.match, null);
    assert.equal(hit.collisions.length, 2);
  });

  await test("a 10-K groups under the quarter it is filed beside", () => {
    assert.equal(periodGroupKey("FY 2025"), "Q4 2025");
    assert.equal(periodGroupKey("Q4 2025"), "Q4 2025");
    assert.equal(periodGroupKey("Q1 2026"), "Q1 2026");
  });

  await test("a group holding an annual report says so", () => {
    assert.equal(periodGroupLabel("Q4 2025", ["Q4 2025", "FY 2025"]), "Q4 2025 and full year");
    assert.equal(periodGroupLabel("Q1 2026", ["Q1 2026"]), "Q1 2026");
  });

  await test("periods sort newest first and unknown labels sort last", () => {
    const sorted = ["Q1 2026", "Q3 2025", "FY 2025", "sometime"].sort(
      (a, b) => periodSortValue(b) - periodSortValue(a)
    );
    assert.deepEqual(sorted, ["Q1 2026", "FY 2025", "Q3 2025", "sometime"]);
    assert.equal(periodSortValue("FY 2025"), periodSortValue("Q4 2025"));
  });

  await test("full-year detection is limited to the FY form", () => {
    assert.ok(isFullYearPeriod("FY 2025"));
    assert.ok(!isFullYearPeriod("Q4 2025"));
  });

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll earnings slug tests passed");
}
main();
