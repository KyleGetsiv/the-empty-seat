// lib/extraction/extract.ts
//
// One model call per chunk: forced tool use against the schema in
// schema.ts, Zod validation of the tool input, then quote verification
// against the chunk text. Anything the model returns that cannot be found
// verbatim in the source is dropped, not stored: the review queue should
// only ever show quotes a reader can find in the primary document.

import Anthropic from "@anthropic-ai/sdk";
import {
  EXTRACTION_MODEL,
  MentionSchema,
  coerceExtractionOutput,
  extractionToolInputSchema,
  type ExtractedMention,
} from "./schema";
import { renderChunk, verifyQuote, type Chunk } from "./text";

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface ChunkResult {
  mentions: (ExtractedMention & { verified_locator: string })[];
  dropped_unverified: number;
  usage: Usage;
}

// Injected so tests can run the pipeline without network access.
export type ModelCaller = (system: string, user: string) => Promise<{ toolInput: unknown; usage: Usage }>;

const TOOL_NAME = "record_mentions";

export const SYSTEM_PROMPT = `You are the extraction step of The Empty Seat, a research site that tracks Waymo using only verifiable primary sources. You are reading passages from an Alphabet document (SEC filing, earnings press release, or earnings call transcript). Every passage is labelled with a bracketed id like [p118] or [t42]; transcript passages also carry the speaker's name.

Your job: find every passage that says something about Waymo, and record it as a verbatim quote with a classification.

Rules:
1. Quote verbatim. Copy the exact characters of the sentence or contiguous sentences that mention Waymo. Never paraphrase, never abbreviate, never join sentences that are not adjacent in the passage. If a passage has two separate Waymo statements far apart, record them as two mentions.
2. Only Waymo. Skip passages where "Waymo" appears only in a list of segment names, a table header, or boilerplate with no substantive statement. Skip passages about other Alphabet units even if they appear near Waymo text.
3. Other Bets figures count. Alphabet reports Waymo inside the Other Bets segment. Sentences stating Other Bets revenue, operating loss, or capital expenditure ARE relevant (mention_type revenue_reference, operating_loss, or capex; extracted_metric.scope 'other_bets'). Say scope 'waymo' only when the number is explicitly about Waymo.
4. Table rows. Financial table rows arrive as one passage each, prefixed with the table's header in square brackets, e.g. "[Segment results (in millions) Quarter Ended March 31, 2025 2026 | Revenues:] Other Bets 450 411". Quote the whole passage including the bracketed prefix so the number keeps its period and unit; the LAST number in the row is the current period unless the header says otherwise. Units follow the caption (usually millions of dollars: 450 -> 450000000).
5. Metrics must be explicit. Attach extracted_metric only when the quote itself states a specific number. Convert to base units (250K rides per week -> 250000; $1.8 billion -> 1800000000). Put the period as stated. If a sentence gives a growth rate but no level, do not invent a level: leave extracted_metric null and classify as ride_count or similar with the growth statement as the quote.
6. Classification: ride_count for trip or ride volume statements; city_count for market or city counts; fleet_size for vehicle counts; revenue_reference, operating_loss, capex for financial statements; forward_guidance for statements about future plans, launches, or targets; strategic_commentary for management framing of the business; competitive_reference when a competitor is named alongside Waymo; safety_reference for safety data or incidents; other when none fit.
7. Locator: the id of the passage the quote comes from, exactly as labelled.
8. Confidence: high when the quote is unambiguously about Waymo and any number is explicit; medium when interpretation was needed; low when uncertain.
9. Return an empty mentions array if nothing qualifies. Do not pad.`;

export function userPrompt(chunk: Chunk, context: { fiscal_period: string; event_type: string; event_date: string }): string {
  return `Document: Alphabet ${context.event_type}, fiscal period ${context.fiscal_period}, dated ${context.event_date}. Chunk ${chunk.index + 1}.

Passages:

${renderChunk(chunk)}`;
}

export function makeAnthropicCaller(client = new Anthropic()): ModelCaller {
  const tool = {
    name: TOOL_NAME,
    description: "Record every qualifying Waymo mention found in the passages.",
    input_schema: extractionToolInputSchema() as Anthropic.Tool["input_schema"],
  };
  return async (system, user) => {
    const res = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 8192,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    return {
      toolInput: block && block.type === "tool_use" ? block.input : { mentions: [] },
      usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens },
    };
  };
}

export async function extractChunk(
  chunk: Chunk,
  context: { fiscal_period: string; event_type: string; event_date: string },
  callModel: ModelCaller
): Promise<ChunkResult> {
  const { toolInput, usage } = await callModel(SYSTEM_PROMPT, userPrompt(chunk, context));
  const coerced = coerceExtractionOutput(toolInput);
  if (!coerced) {
    throw new Error(`Extraction output failed schema validation: no mentions array in tool input (${JSON.stringify(toolInput).slice(0, 200)})`);
  }
  const mentions: ChunkResult["mentions"] = [];
  let dropped = 0;
  for (const raw of coerced.mentions) {
    // Per-mention validation: a malformed mention is dropped and counted,
    // it does not fail the event.
    const parsed = MentionSchema.safeParse(raw);
    if (!parsed.success) {
      dropped++;
      console.warn(`[extract] dropped invalid mention: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
      continue;
    }
    const m = parsed.data;
    const found = verifyQuote(m.quote_text, m.locator, chunk);
    if (!found) {
      dropped++;
      continue;
    }
    // Speaker comes from the source passage, not the model, so it cannot drift.
    const passage = chunk.passages.find((p) => p.id === found)!;
    mentions.push({ ...m, speaker: passage.speaker, verified_locator: found });
  }
  return { mentions, dropped_unverified: dropped, usage };
}
