// lib/extraction/text.ts
//
// Turns a stored source document (SEC filing HTML, press-release exhibit
// HTML, or transcript turns.json) into labelled passages, keeps only the
// passages that can contain a Waymo mention, and packs them into chunks
// sized for one model call each.
//
// Pure functions, no I/O: everything here is unit-tested offline.

import type { SpeakerTurn } from "@/lib/scrapers/transcripts";

// A passage is the unit the model quotes from. `id` is what the model
// returns as `locator` and what lands in waymo_mentions.page_or_timestamp.
export interface Passage {
  id: string; // 't12' (transcript turn) or 'p118' (filing paragraph)
  speaker: string | null;
  text: string;
}

export interface Chunk {
  index: number;
  passages: Passage[];
}

// Alphabet documents talk about Waymo either by name or through the Other
// Bets segment (whose reported revenue and loss are the only financial
// figures that contain Waymo). Both are worth extracting; the model tags
// scope on any metric it lifts from an Other Bets sentence.
export const RELEVANCE_PATTERN = /\bwaymo\b|\bother bets\b/i;

// Model context is not the constraint; precision and cost are. Around 12K
// characters (~3K tokens) per call keeps each request focused enough that
// verbatim quoting stays reliable.
export const CHUNK_TARGET_CHARS = 12_000;

// ---------------------------------------------------------------------------
// HTML to paragraphs (filings, exhibits)
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "\u2014")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function rowText(rowHtml: string): string {
  return decodeEntities(rowHtml.replace(/<(td|th)[^>]*>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// Financial tables lose their meaning row by row ("Other Bets 450 411"
// says nothing about periods or units), so each data row is prefixed with
// the table's header row: the first row whose text has no digits-only
// cells, i.e. the one naming the periods. Prefix capped so it stays a
// label rather than a second passage.
export function annotateTableRows(html: string): string {
  return html.replace(/(<p\b[^>]*>[\s\S]*?<\/p>\s*)?(<table\b[\s\S]*?<\/table>)/gi, (whole, captionHtml: string | undefined, table: string) => {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
    if (rows.length < 2) return whole;
    // A short paragraph right before the table is its caption ("in
    // millions; unaudited") and travels with the header.
    const caption = captionHtml ? rowText(captionHtml) : "";
    const captionPart = caption && caption.length <= 120 ? caption : "";
    // Header = the leading rows whose first cell is empty (SEC financial
    // tables put period labels above an empty stub column), e.g. "Quarter
    // Ended March 31," + "2025 2026" + "(unaudited)". Capped at 4 rows /
    // 160 chars.
    const firstCellEmpty = (r: string) => {
      const cell = r.match(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/i);
      return !cell || rowText(cell[1]).length === 0;
    };
    const headerParts: string[] = [];
    let headerRows = 0;
    for (const r of rows) {
      const t = rowText(r);
      if (!t) { headerRows++; continue; }
      if (!firstCellEmpty(r) || headerParts.length >= 4) break;
      headerParts.push(t);
      headerRows++;
    }
    const header = [captionPart, headerParts.join(" ")].filter(Boolean).join(" ").slice(0, 200).trim();
    if (!header || headerRows >= rows.length) return whole;
    // Section rows (text, no digits, e.g. "Operating income (loss):") label
    // the data rows beneath them and are carried into the prefix.
    let section = "";
    const out = rows.map((r, i) => {
      const t = rowText(r);
      if (!t) return "";
      if (i < headerRows) return `<tr>${t}</tr>`;
      if (!/\d/.test(t)) {
        section = t.slice(0, 80);
        return `<tr>[${header}] ${t}</tr>`;
      }
      return `<tr>[${header}${section ? " | " + section : ""}] ${t}</tr>`;
    });
    return (captionHtml ?? "") + out.join("\n");
  });
}

// Splits filing HTML into paragraphs on block-level boundaries. Inline XBRL
// (10-K/10-Q) wraps numbers in ix: tags, which are inline and survive as
// text; hidden ix:header blocks are dropped. Table rows become one line
// each, prefixed with the table header (see annotateTableRows).
export function htmlToParagraphs(html: string): string[] {
  const cleaned = annotateTableRows(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<ix:header[\s\S]*?<\/ix:header>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
  )
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|blockquote|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(cleaned)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

// ---------------------------------------------------------------------------
// Passages
// ---------------------------------------------------------------------------

export function passagesFromHtml(html: string): Passage[] {
  return htmlToParagraphs(html).map((text, i) => ({ id: `p${i}`, speaker: null, text }));
}

export function passagesFromTurns(turns: SpeakerTurn[]): Passage[] {
  return turns.map((t) => ({ id: `t${t.index}`, speaker: t.speaker, text: t.text }));
}

// Keeps passages that match RELEVANCE_PATTERN plus `context` neighbours on
// each side, so a pronoun ("it grew 5x") in the following sentence still
// resolves. Neighbours are included once even when windows overlap.
export function selectRelevantPassages(passages: Passage[], context = 1): Passage[] {
  const keep = new Set<number>();
  passages.forEach((p, i) => {
    if (!RELEVANCE_PATTERN.test(p.text)) return;
    for (let j = Math.max(0, i - context); j <= Math.min(passages.length - 1, i + context); j++) keep.add(j);
  });
  return passages.filter((_, i) => keep.has(i));
}

// Packs passages into chunks near CHUNK_TARGET_CHARS. A single oversize
// passage becomes its own chunk (never split mid-passage: the model must be
// able to quote it whole).
export function chunkPassages(passages: Passage[], targetChars = CHUNK_TARGET_CHARS): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Passage[] = [];
  let size = 0;
  for (const p of passages) {
    const len = p.text.length + (p.speaker?.length ?? 0) + 16;
    if (current.length > 0 && size + len > targetChars) {
      chunks.push({ index: chunks.length, passages: current });
      current = [];
      size = 0;
    }
    current.push(p);
    size += len;
  }
  if (current.length > 0) chunks.push({ index: chunks.length, passages: current });
  return chunks;
}

// The text the model sees for one chunk. Each passage is labelled with its
// id (and speaker for transcripts) so the model can cite a locator.
export function renderChunk(chunk: Chunk): string {
  return chunk.passages
    .map((p) => (p.speaker ? `[${p.id}] ${p.speaker}: ${p.text}` : `[${p.id}] ${p.text}`))
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Quote verification
// ---------------------------------------------------------------------------

// Normalises the differences a faithful copy can legitimately introduce
// (curly vs straight quotes, dash variants, whitespace runs, case) without
// forgiving actual paraphrase.
export function normalizeForMatch(s: string): string {
  return s
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// A quote is verified when it appears verbatim (after normalisation) in the
// passage it cites, or, failing that, anywhere in the chunk (models
// occasionally cite the neighbouring locator). Returns the passage id the
// quote was actually found in, or null.
export function verifyQuote(quote: string, locator: string, chunk: Chunk): string | null {
  const q = normalizeForMatch(quote);
  if (q.length < 10) return null;
  const cited = chunk.passages.find((p) => p.id === locator);
  if (cited && normalizeForMatch(cited.text).includes(q)) return cited.id;
  for (const p of chunk.passages) {
    if (p.id !== locator && normalizeForMatch(p.text).includes(q)) return p.id;
  }
  return null;
}
