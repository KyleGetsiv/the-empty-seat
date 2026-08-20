// scripts/test-earnings-card.ts
// Offline tests for social card headline selection (4.6b).
// Run with: npx tsx scripts/test-earnings-card.ts
//
// The load-bearing case is that a table row never reaches a card. A card
// travels into other people's feeds with no page around it, so the 4.6a
// mistake would be worse here than it was on the page.

import { strict as assert } from "assert";
import { cardHeadline, truncateForCard, HEADLINE_MAX_CHARS } from "@/lib/earnings-card";
import type { PublicEarningsEvent, PublicMention } from "@/lib/earnings-types";

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

let seq = 0;
function m(over: Partial<PublicMention> = {}): PublicMention {
  return {
    id: `m${seq++}`,
    mentionType: over.mentionType ?? "strategic_commentary",
    quoteText: over.quoteText ?? "Waymo is scaling.",
    speaker: null,
    confidence: "high",
    annotation: null,
    metricSlug: over.metricSlug ?? null,
    metricValue: over.metricValue ?? null,
    metricUnit: over.metricUnit ?? null,
    metricPeriod: null,
    promoted: false,
    locator: null,
  };
}

function e(mentions: PublicMention[], presence: PublicEarningsEvent["presence"] = "has_mentions"): PublicEarningsEvent {
  return {
    id: "e1",
    slug: "alphabet-q2-2026-10-q",
    companySlug: "alphabet",
    fiscalPeriod: "Q2 2026",
    eventType: "10-Q",
    filerName: "Alphabet",
    subjectName: "Waymo",
    eventDate: "2026-07-23",
    processingStatus: "reviewed",
    reviewComplete: true,
    extractionChunks: 3,
    extractionModel: "claude-sonnet-5",
    extractionVersion: 1,
    sourceUrl: null,
    sourceTitle: null,
    sourcePublisher: null,
    mentions,
    presence,
  };
}

const TABLE_ROW = "[Three Months Ended Six Months Ended | Revenues:] Other Bets 373 382 823 793";

test("a table row is never used as a card quote", () => {
  const h = cardHeadline(e([m({ quoteText: TABLE_ROW, metricSlug: "revenue_usd", metricValue: 382000000, metricUnit: "USD" })]));
  assert.equal(h.kind, "figure");
  assert.ok(!h.text.includes("["), "scaffolding reached the card");
  assert.ok(!h.text.includes("|"));
  assert.equal(h.text, "$382,000,000 revenue");
});

test("prose is preferred even when a table row comes first", () => {
  const h = cardHeadline(
    e([
      m({ quoteText: TABLE_ROW, metricSlug: "revenue_usd", metricValue: 382000000 }),
      m({ quoteText: "Waymo now serves riders in eleven metros." }),
    ])
  );
  assert.equal(h.kind, "quote");
  assert.equal(h.text, "Waymo now serves riders in eleven metros.");
});

test("a table row with no parsed figure still does not become a quote", () => {
  const h = cardHeadline(e([m({ quoteText: TABLE_ROW })]));
  assert.notEqual(h.kind, "quote");
  assert.ok(!h.text.includes("373 382"));
});

test("a silent event carries its presence sentence", () => {
  const h = cardHeadline(e([], "no_relevant_passages"));
  assert.equal(h.kind, "silent");
  assert.ok(h.text.includes("no passage mentioning Waymo"));
});

test("an awaiting-review event does not claim Alphabet was silent", () => {
  const h = cardHeadline(e([], "awaiting_review"));
  assert.ok(h.text.includes("not yet reviewed"));
});

test("long quotes truncate without a dangling space", () => {
  const long = "a".repeat(400);
  const out = truncateForCard(long);
  assert.equal(out.length, HEADLINE_MAX_CHARS);
  assert.ok(out.endsWith("..."));
  const spaced = truncateForCard(`${"word ".repeat(80)}end`);
  assert.ok(!spaced.includes(" ..."), "left a space before the ellipsis");
});

test("a short quote is untouched", () => {
  assert.equal(truncateForCard("Waymo."), "Waymo.");
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll earnings card tests passed");
