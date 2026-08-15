// scripts/test-extraction.ts
// Offline tests for the extraction pipeline's pure logic (module 4.4):
// HTML to passages, relevance filtering, chunking, schema validation, and
// verbatim quote verification, using an injected fake model so no network
// or API key is needed. Run with: npx tsx scripts/test-extraction.ts

import { strict as assert } from "assert";
import {
  htmlToParagraphs,
  passagesFromHtml,
  passagesFromTurns,
  selectRelevantPassages,
  chunkPassages,
  renderChunk,
  verifyQuote,
  normalizeForMatch,
} from "@/lib/extraction/text";
import { extractChunk, userPrompt, type ModelCaller } from "@/lib/extraction/extract";
import { ExtractionOutputSchema, extractionToolInputSchema } from "@/lib/extraction/schema";

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

async function main() {
const EXHIBIT_HTML = `
<html><body>
<p><b>Alphabet Announces Second Quarter 2026 Results</b></p>
<p>MOUNTAIN VIEW, Calif. &#8211; July 22, 2026 &#8211; Alphabet Inc. (NASDAQ: GOOG, GOOGL) today announced financial results.</p>
<table><tr><td>Other Bets revenues</td><td>$382</td></tr>
<tr><td>Other Bets operating loss</td><td>$(1,800)</td></tr></table>
<p>&#8220;Waymo is now serving more than 250,000 paid rides per week,&#8221; said Sundar Pichai, CEO. &#8220;We continue to expand.&#8221;</p>
<p>Waymo also began fully autonomous rides for employees in Denver and Nashville, and expects to open to the public later this year.</p>
<p>Google Cloud revenue grew 34% year over year.</p>
<p>YouTube ads revenue was $9.8 billion.</p>
<ix:header><p>hidden xbrl junk Waymo</p></ix:header>
</body></html>`;

const TURNS = [
  { index: 0, speaker: "Operator", text: "Welcome to the Alphabet first quarter 2026 earnings conference call." },
  { index: 1, speaker: "Sundar Pichai", text: "Turning to Other Bets. Waymo is now averaging over 250,000 paid rides per week across its markets. It has driven more than 100 million fully autonomous miles." },
  { index: 2, speaker: "Sundar Pichai", text: "We are on track to launch in Miami and Washington, D.C. in 2026." },
  { index: 3, speaker: "Anat Ashkenazi", text: "Other Bets revenues were $450 million and the operating loss was $1.2 billion." },
  { index: 4, speaker: "Analyst", text: "Thanks. Can you talk about YouTube Shorts monetization?" },
  { index: 5, speaker: "Philipp Schindler", text: "Sure, Shorts monetization continues to close the gap." },
];

await test("htmlToParagraphs drops ix:header, keeps table rows joined, decodes entities", () => {
  const paras = htmlToParagraphs(EXHIBIT_HTML);
  assert.ok(paras.some((p) => p.startsWith("Other Bets revenues $382")), JSON.stringify(paras));
  assert.ok(!paras.some((p) => p.includes("hidden xbrl junk")));
  assert.ok(paras.some((p) => p.includes("“Waymo is now serving")));
  assert.ok(paras.some((p) => p.includes("July 22, 2026 – Alphabet")));
});

await test("selectRelevantPassages keeps Waymo/Other Bets passages plus one neighbour each side", () => {
  const passages = passagesFromHtml(EXHIBIT_HTML);
  const rel = selectRelevantPassages(passages);
  const texts = rel.map((p) => p.text);
  assert.ok(texts.some((t) => t.includes("Waymo is now serving")));
  assert.ok(texts.some((t) => t.includes("Denver and Nashville")));
  assert.ok(texts.some((t) => t.startsWith("Other Bets revenues")));
  // Google Cloud is the neighbour of the Denver passage: kept as context.
  assert.ok(texts.some((t) => t.startsWith("Google Cloud")));
  // YouTube is two away from any hit: dropped.
  assert.ok(!texts.some((t) => t.startsWith("YouTube")));
});

await test("passagesFromTurns labels t{index} and keeps speaker; filter keeps context turn", () => {
  const passages = passagesFromTurns(TURNS);
  assert.equal(passages[1].id, "t1");
  assert.equal(passages[1].speaker, "Sundar Pichai");
  const rel = selectRelevantPassages(passages);
  const ids = rel.map((p) => p.id);
  assert.deepEqual(ids, ["t0", "t1", "t2", "t3", "t4"]);
});

await test("chunkPassages packs to target and never splits a passage", () => {
  const passages = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, speaker: null, text: "Waymo ".repeat(200) }));
  const chunks = chunkPassages(passages, 5000);
  assert.ok(chunks.length > 1);
  const total = chunks.reduce((n, c) => n + c.passages.length, 0);
  assert.equal(total, 30);
  for (const c of chunks) assert.ok(renderChunk(c).length <= 5000 + 1300);
  // one oversize passage still gets its own chunk
  const big = chunkPassages([{ id: "p0", speaker: null, text: "x".repeat(20000) }], 5000);
  assert.equal(big.length, 1);
});

await test("renderChunk labels passages with id and speaker", () => {
  const chunks = chunkPassages(passagesFromTurns(TURNS));
  const text = renderChunk(chunks[0]);
  assert.ok(text.includes("[t1] Sundar Pichai: Turning to Other Bets."));
  assert.ok(userPrompt(chunks[0], { fiscal_period: "Q1 2026", event_type: "earnings_call", event_date: "2026-04-29" }).includes("fiscal period Q1 2026"));
});

await test("verifyQuote: verbatim passes, curly quotes tolerated, paraphrase fails, wrong locator recovers", () => {
  const chunk = chunkPassages(passagesFromTurns(TURNS))[0];
  assert.equal(verifyQuote("Waymo is now averaging over 250,000 paid rides per week across its markets.", "t1", chunk), "t1");
  assert.equal(verifyQuote("Waymo is now averaging over 250,000 paid rides per week", "t2", chunk), "t1");
  assert.equal(verifyQuote("Waymo averages 250K rides weekly across markets today.", "t1", chunk), null);
  assert.equal(normalizeForMatch("“Waymo’s”"), '"waymo\'s"');
  const html = chunkPassages(selectRelevantPassages(passagesFromHtml(EXHIBIT_HTML)))[0];
  const cited = html.passages.find((p) => p.text.includes("Waymo is now serving"))!.id;
  assert.equal(verifyQuote('"Waymo is now serving more than 250,000 paid rides per week," said Sundar Pichai', cited, html), cited);
});

await test("schema: valid output parses, bad enum and short quote rejected, tool schema is an object schema", () => {
  const ok = ExtractionOutputSchema.safeParse({
    mentions: [{ locator: "t1", quote_text: "Waymo is now averaging over 250,000 paid rides per week across its markets.", speaker: "Sundar Pichai", mention_type: "ride_count", extracted_metric: { metric: "weekly_rides", value: 250000, unit: "paid rides per week", period: "Q1 2026", scope: "waymo" }, confidence: "high" }],
  });
  assert.ok(ok.success);
  assert.ok(!ExtractionOutputSchema.safeParse({ mentions: [{ locator: "t1", quote_text: "short", speaker: null, mention_type: "ride_count", extracted_metric: null, confidence: "high" }] }).success);
  assert.ok(!ExtractionOutputSchema.safeParse({ mentions: [{ locator: "t1", quote_text: "Waymo is now averaging over 250,000 paid rides per week", speaker: null, mention_type: "rides", extracted_metric: null, confidence: "high" }] }).success);
  const js = extractionToolInputSchema() as { type: string; properties: Record<string, unknown> };
  assert.equal(js.type, "object");
  assert.ok("mentions" in js.properties);
});

await test("extractChunk: keeps verified mentions, drops paraphrase, speaker comes from passage, usage summed", async () => {
  const chunk = chunkPassages(selectRelevantPassages(passagesFromTurns(TURNS)))[0];
  const fake: ModelCaller = async () => ({
    toolInput: {
      mentions: [
        { locator: "t1", quote_text: "Waymo is now averaging over 250,000 paid rides per week across its markets.", speaker: "Wrong Name", mention_type: "ride_count", extracted_metric: { metric: "weekly_rides", value: 250000, unit: "paid rides per week", period: null, scope: "waymo" }, confidence: "high" },
        { locator: "t3", quote_text: "Other Bets revenues were $450 million and the operating loss was $1.2 billion.", speaker: "Anat Ashkenazi", mention_type: "operating_loss", extracted_metric: { metric: "operating_loss_usd", value: 1200000000, unit: "USD", period: "Q1 2026", scope: "other_bets" }, confidence: "high" },
        { locator: "t2", quote_text: "Waymo will launch in Miami and DC next year according to management.", speaker: "Sundar Pichai", mention_type: "forward_guidance", extracted_metric: null, confidence: "medium" },
      ],
    },
    usage: { input_tokens: 1200, output_tokens: 300 },
  });
  const r = await extractChunk(chunk, { fiscal_period: "Q1 2026", event_type: "earnings_call", event_date: "2026-04-29" }, fake);
  assert.equal(r.mentions.length, 2);
  assert.equal(r.dropped_unverified, 1);
  assert.equal(r.mentions[0].speaker, "Sundar Pichai");
  assert.equal(r.mentions[0].verified_locator, "t1");
  assert.equal(r.usage.input_tokens, 1200);
});

await test("extractChunk: schema violation from the model throws (caller marks event failed)", async () => {
  const chunk = chunkPassages(passagesFromTurns(TURNS))[0];
  const bad: ModelCaller = async () => ({ toolInput: { mentions: "nope" }, usage: { input_tokens: 1, output_tokens: 1 } });
  await assert.rejects(() => extractChunk(chunk, { fiscal_period: "Q1 2026", event_type: "earnings_call", event_date: "2026-04-29" }, bad), /schema validation/);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll extraction tests passed");
}
main();
