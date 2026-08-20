// scripts/test-promotion-slug.ts
// Offline tests for promotion slug resolution (module 4.12). Pure functions.
// Run with: npx tsx scripts/test-promotion-slug.ts
//
// The two cases that motivated the module are first: both are real quotes
// from the corpus, and both were filed as weekly_rides by the mention_type
// map even though the model read them correctly.

import { strict as assert } from "assert";
import {
  resolvePromotionSlug,
  isPromotableMetric,
  PROMOTABLE_METRICS,
  METRIC_PROMOTION,
} from "@/lib/earnings-mentions";

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${name}\n      ${err instanceof Error ? err.message : err}`);
  }
}

// "safely serving more than 4 million passenger trips": mention_type
// ride_count, model read cumulative_trips. Filed as weekly_rides before 4.12.
test("a cumulative reading promotes to cumulative_trips, never weekly_rides", () => {
  assert.equal(resolvePromotionSlug("cumulative_trips", "ride_count"), "cumulative_trips");
});

// "more than 400,000 rides every week": same mention_type, weekly reading.
test("a weekly reading still promotes to weekly_rides", () => {
  assert.equal(resolvePromotionSlug("weekly_rides", "ride_count"), "weekly_rides");
});

test("the model's reading wins over the mention type in every disagreement", () => {
  assert.equal(resolvePromotionSlug("cities_count", "ride_count"), "cities_count");
  assert.equal(resolvePromotionSlug("fleet_size", "city_count"), "fleet_size");
});

// The fallback is the whole residual risk surface, so it is pinned.
test("mention_type is used only when the model named no quantity", () => {
  assert.equal(resolvePromotionSlug(null, "ride_count"), "weekly_rides");
  assert.equal(resolvePromotionSlug(undefined, "city_count"), "cities_count");
  assert.equal(resolvePromotionSlug("other", "fleet_size"), "fleet_size");
});

// Falling back here would file a revenue figure as weekly rides: the original
// bug wearing a different hat.
test("a valid but unpromotable slug promotes nothing rather than falling back", () => {
  assert.equal(resolvePromotionSlug("revenue_usd", "ride_count"), null);
  assert.equal(resolvePromotionSlug("operating_loss_usd", "ride_count"), null);
  assert.equal(resolvePromotionSlug("capex_usd", "city_count"), null);
});

test("a non-promoting mention type with no model slug promotes nothing", () => {
  assert.equal(resolvePromotionSlug(null, "strategic_commentary"), null);
  assert.equal(resolvePromotionSlug("other", "competitive_reference"), null);
});

test("every slug the fallback map can produce is promotable", () => {
  for (const slug of Object.values(METRIC_PROMOTION)) {
    assert.ok(isPromotableMetric(slug), `${slug} is mapped but not promotable`);
  }
});

// The gap 4.12 exists to close: before it, no input could reach
// cumulative_trips, so the slug was dead.
test("every promotable slug is reachable from some input", () => {
  const reachable = new Set<string>();
  for (const type of Object.keys(METRIC_PROMOTION)) {
    const s = resolvePromotionSlug(null, type);
    if (s) reachable.add(s);
  }
  for (const slug of PROMOTABLE_METRICS) {
    const s = resolvePromotionSlug(slug, "other");
    if (s) reachable.add(s);
  }
  for (const slug of PROMOTABLE_METRICS) {
    assert.ok(reachable.has(slug), `${slug} is unreachable: nothing can promote to it`);
  }
});

test("resolution is a pure lookup with no surprises for empty input", () => {
  assert.equal(resolvePromotionSlug("", "ride_count"), "weekly_rides");
  assert.equal(resolvePromotionSlug(null, ""), null);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll promotion slug tests passed");
