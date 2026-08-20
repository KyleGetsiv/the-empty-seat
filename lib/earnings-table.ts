// lib/earnings-table.ts
//
// Client-safe. Reads back the prefix that `annotateTableRows` in
// lib/extraction/text.ts writes onto every table row before extraction.
//
// That function turns
//     <tr>Other Bets 373 382 823 793</tr>
// into
//     [Three Months Ended Six Months Ended | Revenues:] Other Bets 373 382 823 793
// so the model can tell what a bare row of numbers is. The prefix is
// scaffolding: Alphabet never wrote it, and the row it decorates is not a
// sentence anybody uttered. Storing it in quote_text is correct, because
// verifyQuote matches against the passage text including the prefix and that
// verbatim guarantee is the point. Publishing it as a quotation was the 4.6a
// bug this module exists to fix.
//
// This is a reader for a format another module owns. If annotateTableRows
// changes its prefix shape, parsing returns null and the mention falls back
// to rendering as an ordinary quote: degraded, never wrong. The tests pin the
// current shape against real rows from the Q2 2026 10-Q.

import type { PublicMention } from "@/lib/earnings-types";

export interface TableReading {
  // The table's caption and column headers, as one string.
  columns: string;
  // The section label the row sits under ("Revenues:"), when the table has one.
  section: string | null;
  // The row's own label ("Other Bets").
  rowLabel: string;
  // The row's cells, with parenthesized negatives regrouped: "( 1,246 )"
  // arrives as three tokens and leaves as "(1,246)".
  values: string[];
  // The stored quote, unmodified. What the reader can check against the source.
  raw: string;
}

const PREFIX_RE = /^\[([^\]]*)\]\s*([\s\S]*)$/;
const BARE_NUM = /^[$€£]?-?\d[\d,]*(\.\d+)?%?$/;

function startsValueRun(tokens: string[], i: number): boolean {
  const t = tokens[i];
  if (BARE_NUM.test(t)) return true;
  // "(" split from its number by the cell-to-space conversion, or kept with it.
  if (t === "(" && i + 1 < tokens.length && BARE_NUM.test(tokens[i + 1])) return true;
  if (/^\(\s*\d/.test(t)) return true;
  // A dash run is how an empty cell survives the conversion.
  if (/^-{2,}$/.test(t)) return true;
  return false;
}

function groupValues(tokens: string[]): string[] {
  const out: string[] = [];
  let open: string | null = null;
  for (const t of tokens) {
    if (t === "(") {
      open = "(";
      continue;
    }
    if (t === ")") {
      if (open !== null) {
        out.push(`${open})`);
        open = null;
      }
      continue;
    }
    if (open !== null) {
      open += t;
      continue;
    }
    out.push(t);
  }
  if (open !== null) out.push(open);
  return out;
}

function splitRow(rowText: string): { rowLabel: string; values: string[] } {
  const tokens = rowText.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < tokens.length && !startsValueRun(tokens, i)) i++;
  return {
    rowLabel: tokens.slice(0, i).join(" "),
    values: groupValues(tokens.slice(i)),
  };
}

// Returns null for anything that is not a prefixed table row, which is every
// ordinary quote. Callers treat null as "this is a real utterance".
export function parseTableReading(quoteText: string): TableReading | null {
  const matched = PREFIX_RE.exec(quoteText.trim());
  if (!matched) return null;

  const inside = matched[1].trim();
  const rowText = matched[2].trim();
  if (!inside || !rowText) return null;

  // The section is appended last by annotateTableRows, so the final " | " is
  // the separator even if a header cell happens to contain one.
  const sep = inside.lastIndexOf(" | ");
  const columns = sep === -1 ? inside : inside.slice(0, sep).trim();
  const section = sep === -1 ? null : inside.slice(sep + 3).trim() || null;

  const { rowLabel, values } = splitRow(rowText);
  return { columns, section, rowLabel, values, raw: quoteText.trim() };
}

export function isTableReading(quoteText: string): boolean {
  return parseTableReading(quoteText) !== null;
}

// The document's own words for what the row is, in reading order: section
// label then row label. Composed from two strings the filing supplied, never
// invented. Empty when the table carried neither, in which case the caller
// falls back to the column header.
export function readingLabel(reading: TableReading): string {
  return [reading.section?.replace(/:$/, ""), reading.rowLabel].filter(Boolean).join(", ");
}

// --- partitioning -----------------------------------------------------------


export interface PartitionedMentions {
  // Things a person said or wrote in prose. These are quotations.
  statements: PublicMention[];
  // Rows read out of a financial table. These are readings, not quotations,
  // and the permalink presents them under their own heading so the page never
  // claims a spreadsheet cell was spoken.
  figures: PublicMention[];
}

export function partitionMentions(mentions: PublicMention[]): PartitionedMentions {
  const statements: PublicMention[] = [];
  const figures: PublicMention[] = [];
  for (const m of mentions) {
    (isTableReading(m.quoteText) ? figures : statements).push(m);
  }
  return { statements, figures };
}

// "3 statements and 2 figures", or just one half when the other is empty.
// Used in place of a flat mention count, which called a table row a statement.
export function describeMentionMix(mentions: PublicMention[]): string {
  const { statements, figures } = partitionMentions(mentions);
  const parts: string[] = [];
  if (statements.length > 0) {
    parts.push(`${statements.length} ${statements.length === 1 ? "statement" : "statements"}`);
  }
  if (figures.length > 0) {
    parts.push(`${figures.length} ${figures.length === 1 ? "figure" : "figures"}`);
  }
  return parts.join(" and ");
}
