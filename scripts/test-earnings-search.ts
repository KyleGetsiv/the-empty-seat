// scripts/test-earnings-search.ts
// Offline tests for the /earnings filter (4.6b). Pure functions, no Supabase
// and no network. Run with: npx tsx scripts/test-earnings-search.ts
//
// The load-bearing case is "the synthesized table prefix is not matchable".
// Everything else is ordinary filter behaviour.

import { strict as assert } from "assert";
import {
  normalizeForSearch,
  mentionHaystack,
  buildSearchIndex,
  filterEvents,
} from "@/lib/earnings-search";
import type { PublicMention, PublicEarningsEvent } from "@/lib/earnings-types";

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

function mention(over: Partial<PublicMention> = {}): PublicMention {
  return {
    id: over.id ?? "m1",
    mentionType: over.mentionType ?? "strategic_commentary",
    quoteText: over.quoteText ?? "Waymo is now serving riders in more cities.",
    speaker: over.speaker ?? null,
    confidence: "high",
    annotation: over.annotation ?? null,
    metricSlug: over.metricSlug ?? null,
    metricValue: over.metricValue ?? null,
    metricUnit: over.metricUnit ?? null,
    metricPeriod: over.metricPeriod ?? null,
    promoted: over.promoted ?? false,
    locator: null,
  };
}

function event(over: Partial<PublicEarningsEvent> = {}): PublicEarningsEvent {
  return {
    id: over.id ?? "e1",
    slug: over.slug ?? "alphabet-q2-2026-10-q",
    companySlug: "alphabet",
    fiscalPeriod: over.fiscalPeriod ?? "Q2 2026",
    eventType: over.eventType ?? "10-Q",
    filerName: "Alphabet",
    subjectName: "Waymo",
    eventDate: over.eventDate ?? "2026-07-23",
    processingStatus: "reviewed",
    reviewComplete: true,
    extractionChunks: 3,
    extractionModel: "claude-sonnet-5",
    extractionVersion: 1,
    sourceUrl: null,
    sourceTitle: null,
    sourcePublisher: over.sourcePublisher ?? "SEC EDGAR",
    mentions: over.mentions ?? [mention()],
    presence: "has_mentions",
  };
}

const TABLE_ROW =
  "[Three Months Ended Six Months Ended | Revenues:] Other Bets 373 382 823 793";

async function main() {
  // The reason this module exists.
  await test("the synthesized bracket prefix is not in the haystack", () => {
    const h = mentionHaystack(mention({ quoteText: TABLE_ROW, mentionType: "revenue_reference" }));
    assert.ok(!h.includes("["), "bracket leaked into the index");
    assert.ok(!h.includes("|"), "pipe leaked into the index");
  });

  await test("a phrase spanning the synthetic boundary does not match", () => {
    const h = mentionHaystack(mention({ quoteText: TABLE_ROW }));
    // "Ended" and "Revenues" are adjacent only because annotateTableRows put
    // them there. No filing contains that phrase, so it must not be findable.
    assert.ok(!h.includes("ended | revenues"));
    assert.ok(!h.includes("ended revenues"));
  });

  await test("the document's own words in that row are still findable", () => {
    const h = mentionHaystack(mention({ quoteText: TABLE_ROW }));
    assert.ok(h.includes("other bets"));
    assert.ok(h.includes("382"));
    assert.ok(h.includes("revenues"));
    assert.ok(h.includes("three months ended"));
  });

  await test("prose is indexed as written", () => {
    const q = "Within Other Bets, we are investing significantly in transportation.";
    assert.ok(mentionHaystack(mention({ quoteText: q })).includes("investing significantly"));
  });

  await test("curly quotes and typographic dashes normalize", () => {
    assert.equal(normalizeForSearch("Waymo’s “scale”"), "waymo's \"scale\"");
    // Written as an escape, not a literal: the no-em-dash rule is enforced by
    // grep across the repo, and test data should not make that grep noisy.
    assert.equal(normalizeForSearch("2025\u20132026"), "2025-2026");
  });

  await test("speaker and mention type are searchable", () => {
    const h = mentionHaystack(mention({ speaker: "Sundar Pichai", mentionType: "forward_guidance" }));
    assert.ok(h.includes("sundar pichai"));
    assert.ok(h.includes("guidance"));
  });

  await test("an empty query returns everything and reports unfiltered", () => {
    const r = filterEvents(buildSearchIndex([event(), event({ id: "e2" })]), "   ");
    assert.equal(r.events.length, 2);
    assert.equal(r.unfiltered, true);
  });

  await test("an event matching on its own identity keeps all its mentions", () => {
    const e = event({ mentions: [mention({ id: "a" }), mention({ id: "b", quoteText: "unrelated" })] });
    const r = filterEvents(buildSearchIndex([e]), "10-Q");
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].mentions.length, 2);
    assert.equal(r.matchedMentions, 2);
  });

  await test("an event matching only on a quote is narrowed to that quote", () => {
    const e = event({
      mentions: [
        mention({ id: "a", quoteText: "Waymo expanded to Denver." }),
        mention({ id: "b", quoteText: "GFiber remains in the segment." }),
      ],
    });
    const r = filterEvents(buildSearchIndex([e]), "denver");
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].mentions.length, 1);
    assert.equal(r.events[0].mentions[0].id, "a");
  });

  await test("a query matching nothing returns no events", () => {
    const r = filterEvents(buildSearchIndex([event()]), "zoox");
    assert.equal(r.events.length, 0);
    assert.equal(r.matchedMentions, 0);
    assert.equal(r.unfiltered, false);
  });

  await test("filtering never mutates the source events", () => {
    const e = event({
      mentions: [mention({ id: "a", quoteText: "Denver" }), mention({ id: "b", quoteText: "other" })],
    });
    filterEvents(buildSearchIndex([e]), "denver");
    assert.equal(e.mentions.length, 2, "source event was mutated");
  });

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll earnings search tests passed");
}
main();
