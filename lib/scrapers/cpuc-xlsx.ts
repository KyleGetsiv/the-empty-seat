// lib/scrapers/cpuc-xlsx.ts
// Minimal xlsx reader for CPUC pilot-program filings (module 3.4). Some
// pilot carriers (Zoox) submit the CPUC data template as an Excel workbook
// rather than CSVs; the "Month-Level" sheet carries the same columns as
// the deployment-tier AV_Month CSV. An xlsx is a zip of XML; fflate unzips
// it and the sheet is parsed with a small, deliberately narrow XML walk
// (shared strings + inline strings + numeric cells). No spreadsheet
// library dependency: the schema is fixed and tiny.

import { unzipSync, strToU8 } from "fflate";

function decode(u8: Uint8Array): string {
  return new TextDecoder().decode(u8);
}

// Column letters to 0-based index: A=0, B=1, ..., Z=25, AA=26.
function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const parts = [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]);
    out.push(parts.join(""));
  }
  return out;
}

// Returns rows as arrays of cell strings, ragged (trailing empties dropped).
export function sheetToRows(sheetXml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(sheetXml))) {
    const cells: string[] = [];
    // Cells: <c r="B2" t="s"><v>3</v></c>  or  <c r="C2"><v>5219</v></c>
    // or inline: <c r="D2" t="inlineStr"><is><t>text</t></is></c>
    const cellRe = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1] ?? cm[2] ?? "";
      const inner = cm[3] ?? "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/);
      if (!ref) continue;
      const idx = colIndex(ref[1]);
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      let value = "";
      if (type === "s") {
        const v = inner.match(/<v>([^<]*)<\/v>/)?.[1];
        value = v != null ? (sharedStrings[parseInt(v, 10)] ?? "") : "";
      } else if (type === "inlineStr") {
        value = [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("");
      } else {
        value = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
      }
      while (cells.length < idx) cells.push("");
      cells[idx] = value;
    }
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    rows.push(cells);
  }
  return rows;
}

// Extracts a named sheet from an xlsx byte array as rows of strings.
// Sheet lookup is by name (case-insensitive, whitespace-tolerant).
export function readXlsxSheet(xlsxBytes: Uint8Array, sheetName: string): string[][] {
  const files = unzipSync(xlsxBytes, {
    filter: (f) =>
      f.name === "xl/workbook.xml" ||
      f.name === "xl/_rels/workbook.xml.rels" ||
      f.name === "xl/sharedStrings.xml" ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name),
  });

  const workbook = decode(files["xl/workbook.xml"] ?? strToU8(""));
  const rels = decode(files["xl/_rels/workbook.xml.rels"] ?? strToU8(""));
  const shared = files["xl/sharedStrings.xml"]
    ? parseSharedStrings(decode(files["xl/sharedStrings.xml"]))
    : [];

  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const sheetTag = [...workbook.matchAll(/<sheet\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => {
      const name = tag.match(/\bname="([^"]+)"/)?.[1] ?? "";
      return norm(name) === norm(sheetName);
    });
  if (!sheetTag) {
    const available = [...workbook.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1]);
    throw new Error(`Sheet "${sheetName}" not found; sheets: ${available.join(", ")}`);
  }
  const rId = sheetTag.match(/\br:id="([^"]+)"/)?.[1];
  if (!rId) throw new Error(`Sheet "${sheetName}" has no r:id`);

  // Relationship lookup: Id="rIdN" ... Target="worksheets/sheet3.xml"
  const relTag = [...rels.matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => tag.includes(`Id="${rId}"`));
  const targetRaw = relTag?.match(/\bTarget="([^"]+)"/)?.[1];
  if (!targetRaw) throw new Error(`No relationship target for ${rId}`);
  const target = targetRaw.startsWith("/") ? targetRaw.slice(1) : `xl/${targetRaw}`;

  const sheetXml = files[target];
  if (!sheetXml) throw new Error(`Sheet part ${target} missing from workbook`);
  return sheetToRows(decode(sheetXml), shared);
}

// Serializes rows back to CSV text (for reuse of the CSV month parser and
// for archiving a compact, human-readable copy in Storage).
export function rowsToCsv(rows: string[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => r.map(esc).join(","))
    .join("\n") + "\n";
}
