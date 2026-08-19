// scripts/test-state-tiers.ts
// Fixture-based tests for the state presence fill (lib/state-tiers.ts).
// No test framework, same lightweight convention as the scraper suites.
// The fixture is the shipped boundary asset itself, public/us-states.json,
// so a future re-simplification of that file is caught here rather than by
// someone noticing a state is the wrong shade.
//
// The geocoding block exists because the first cut of the asset was
// simplified at weight 0.05 to save payload, and at that setting downtown
// San Francisco fell outside the California polygon while Washington DC
// collapsed into Maryland. Both shaded silently wrong with no error
// anywhere. Weight 0.01 is the setting that keeps every named market inside
// its own state; if the asset is ever regenerated, run this first.
//
// Run with: npx tsx scripts/test-state-tiers.ts
// (tsx is not in devDependencies; npm install -D tsx if it is missing.)

import { readFileSync } from "fs";
import { resolve } from "path";
import { strict as assert } from "assert";
import {
  computeStateTiers,
  supervisionCountsAsDriverless,
  tierForStatus,
  tiersPresent,
  tierFillExpression,
  type StatesFeatureCollection,
  type TierCity,
} from "@/lib/state-tiers";

const states = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/us-states.json"), "utf8")
) as StatesFeatureCollection;

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${(err as Error).message.split("\n")[0]}`);
  }
}

const tiersFor = (cities: TierCity[]) => computeStateTiers(cities, states);
function stateOf(lat: number, lng: number): string {
  return Object.keys(tiersFor([{ status: "public", latitude: lat, longitude: lng }]))[0] ?? "(none)";
}

// --- boundary asset integrity ----------------------------------------------

console.log("\nBoundary asset:");

test("asset carries all 50 states plus DC", () => {
  assert.equal(states.features.length, 51);
  const codes = new Set(states.features.map((f) => f.properties.st));
  for (const c of ["CA", "TX", "AZ", "FL", "NV", "GA", "TN", "CO", "MI", "DC", "AK", "HI"]) {
    assert.ok(codes.has(c), `missing ${c}`);
  }
});

// Every market in the current roster, plus the named future markets from the
// dev-plan briefing. A re-simplification that drops any of these shades wrong.
const GEOCODE: [string, number, number, string][] = [
  ["Phoenix", 33.4484, -112.074, "AZ"],
  ["San Francisco", 37.7749, -122.4194, "CA"],
  ["Los Angeles", 34.0522, -118.2437, "CA"],
  ["San Diego", 32.7157, -117.1611, "CA"],
  ["Sacramento", 38.5816, -121.4944, "CA"],
  ["Santa Clara", 37.3541, -121.9552, "CA"],
  ["Miami", 25.7617, -80.1918, "FL"],
  ["Orlando", 28.5383, -81.3792, "FL"],
  ["Tampa", 27.9506, -82.4572, "FL"],
  ["Austin", 30.2672, -97.7431, "TX"],
  ["Dallas", 32.7767, -96.797, "TX"],
  ["Houston", 29.7604, -95.3698, "TX"],
  ["San Antonio", 29.4241, -98.4936, "TX"],
  ["Arlington", 32.7357, -97.1081, "TX"],
  ["Atlanta", 33.749, -84.388, "GA"],
  ["Nashville", 36.1627, -86.7816, "TN"],
  ["Las Vegas", 36.1699, -115.1398, "NV"],
  ["Denver", 39.7392, -104.9903, "CO"],
  ["Detroit", 42.3314, -83.0458, "MI"],
  ["Washington DC", 38.9072, -77.0369, "DC"],
  ["Seattle", 47.6062, -122.3321, "WA"],
  ["Boston", 42.3601, -71.0589, "MA"],
  ["New York", 40.7128, -74.006, "NY"],
  ["Philadelphia", 39.9526, -75.1652, "PA"],
  ["Chicago", 41.8781, -87.6298, "IL"],
  ["New Orleans", 29.9511, -90.0715, "LA"],
];

console.log("\nGeocoding every named market:");
for (const [name, lat, lng, want] of GEOCODE) {
  test(`${name} resolves to ${want}`, () => assert.equal(stateOf(lat, lng), want));
}

// --- tier logic -------------------------------------------------------------

console.log("\nTier logic:");

test("status maps to the documented tiers", () => {
  assert.equal(tierForStatus("public"), 3);
  assert.equal(tierForStatus("waitlist"), 2);
  assert.equal(tierForStatus("employee"), 2);
  assert.equal(tierForStatus("announced"), 1);
  assert.equal(tierForStatus("paused"), 1);
  assert.equal(tierForStatus("nonsense"), null);
});

test("highest tier wins within a state", () => {
  assert.deepEqual(
    tiersFor([
      { status: "announced", latitude: 32.7157, longitude: -117.1611 },
      { status: "public", latitude: 37.7749, longitude: -122.4194 },
      { status: "employee", latitude: 38.5816, longitude: -121.4944 },
    ]),
    { CA: 3 }
  );
});

test("a paused market does not read as active service", () => {
  assert.deepEqual(tiersFor([{ status: "paused", latitude: 33.4484, longitude: -112.074 }]), { AZ: 1 });
});

// --- the supervision gate ---------------------------------------------------

console.log("\nSupervision gate:");

test("supervision values classify correctly", () => {
  assert.equal(supervisionCountsAsDriverless("driverless"), true);
  assert.equal(supervisionCountsAsDriverless("mixed"), true);
  assert.equal(supervisionCountsAsDriverless("safety_operator"), false);
  assert.equal(supervisionCountsAsDriverless("human_is_legal_driver"), false);
  assert.equal(supervisionCountsAsDriverless(null), false);
});

test("Tesla's seven metros shade no state", () => {
  const tesla: TierCity[] = [
    [30.2672, -97.7431],
    [32.7767, -96.797],
    [29.7604, -95.3698],
    [25.7617, -80.1918],
    [28.5383, -81.3792],
    [27.9506, -82.4572],
    [37.7749, -122.4194],
  ].map(([lat, lng]) => ({
    status: "public",
    latitude: lat,
    longitude: lng,
    driverless: supervisionCountsAsDriverless("human_is_legal_driver"),
  }));
  assert.deepEqual(tiersFor(tesla), {});
});

test("a supervised market cannot outrank a driverless one in the same state", () => {
  assert.deepEqual(
    tiersFor([
      { status: "announced", latitude: 37.7749, longitude: -122.4194, driverless: true },
      { status: "public", latitude: 37.7749, longitude: -122.4194, driverless: false },
    ]),
    { CA: 1 }
  );
});

// --- robustness -------------------------------------------------------------

console.log("\nRobustness:");

test("non-US markets are ignored", () => {
  assert.deepEqual(
    tiersFor([
      { status: "public", latitude: 51.5074, longitude: -0.1278, name: "London" },
      { status: "public", latitude: 25.2048, longitude: 55.2708, name: "Dubai" },
      { status: "public", latitude: 35.6762, longitude: 139.6503, name: "Tokyo" },
    ]),
    {}
  );
});

test("bad coordinates do not throw or shade", () => {
  assert.deepEqual(tiersFor([{ status: "public", latitude: NaN, longitude: NaN }]), {});
  assert.deepEqual(tiersFor([{ status: "public", latitude: 25, longitude: -40 }]), {});
});

test("empty roster yields an empty fill and a white fallback", () => {
  assert.deepEqual(tiersFor([]), {});
  assert.equal(tierFillExpression({}), "#FFFFFF");
});

test("legend never advertises an absent step", () => {
  assert.deepEqual(tiersPresent({ CA: 3, TX: 3, CO: 2 }), [2, 3]);
  assert.deepEqual(tiersPresent({}), []);
});

test("fill expression is a well formed match over the postal code", () => {
  const expr = tierFillExpression({ CA: 3, CO: 2 }) as unknown[];
  assert.equal(expr[0], "match");
  assert.deepEqual(expr[1], ["get", "st"]);
  assert.equal(expr[2], "CA");
  assert.equal(expr[3], "#9FB6CC");
  assert.equal(expr[expr.length - 1], "#FFFFFF");
});

// --- end to end -------------------------------------------------------------

console.log("\nAugust 2026 roster end to end:");

test("the real roster produces the expected shading", () => {
  const roster: [string, number, number][] = [
    ["public", 33.4484, -112.074],
    ["public", 37.7749, -122.4194],
    ["public", 34.0522, -118.2437],
    ["public", 25.7617, -80.1918],
    ["public", 28.5383, -81.3792],
    ["public", 30.2672, -97.7431],
    ["public", 33.749, -84.388],
    ["public", 32.7767, -96.797],
    ["public", 36.1627, -86.7816],
    ["waitlist", 29.7604, -95.3698],
    ["waitlist", 29.4241, -98.4936],
    ["employee", 36.1699, -115.1398],
    ["employee", 39.7392, -104.9903],
    ["employee", 32.7157, -117.1611],
    ["employee", 27.9506, -82.4572],
    ["announced", 42.3314, -83.0458],
    ["announced", 38.9072, -77.0369],
    ["announced", 38.5816, -121.4944],
    ["public", 36.1699, -115.1398],
  ];
  assert.deepEqual(
    computeStateTiers(
      roster.map(([status, latitude, longitude]) => ({ status, latitude, longitude, driverless: true })),
      states
    ),
    { AZ: 3, CA: 3, FL: 3, TX: 3, GA: 3, TN: 3, NV: 3, CO: 2, MI: 1, DC: 1 }
  );
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nState tier tests passed");
