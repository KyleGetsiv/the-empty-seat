/**
 * Replaces the three TODO blocks in the live methodology_body row with
 * user-authored copy, swaps the placeholder contact email for the real
 * address, and removes the email TODO marker. Idempotent: re-running is
 * a no-op once all replacements have been applied.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // env vars may already be set in the shell
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const INTRO_TODO = `<!-- TODO: user to replace with editorial framing of why this methodology page exists. One paragraph. -->`;
const INTRO_REPLACEMENT = `This page documents how the data on The Empty Seat is collected, what it represents, and where its limits lie. Every quantitative claim on the site rests on either a primary regulatory or corporate disclosure, or an explicit estimate built on disclosed inputs. Both are sourced; both are dated; the methodology behind each is described here. The audience is sophisticated readers of financial documents, and this page is written for them.`;

const ESTIMATION_TODO = `<!-- TODO: user to replace with methodology principles for estimated data. Phase 1 has minimal estimation (most data is disclosed), but Phase 2 onward introduces assumptions. Reserve the section now. -->`;
const ESTIMATION_REPLACEMENT = `## Estimated data

Phase 1 of the site relies almost entirely on disclosed data: California PUC quarterly reports, Waymo's own published figures, and SEC filings from Alphabet. As later phases introduce unit economics modeling, implied standalone P&L, and competitive comparisons, some figures will be estimates rather than disclosures. Every estimate on the site will be flagged inline, will trace to its disclosed inputs, and will state its assumptions in this section. As of the current build, no estimated figures are surfaced.`;

const CHANGELOG_TODO_LINE = `<!-- TODO: user to replace; track methodology updates here. -->\n`;
const EMAIL_TODO_BLOCK = `\n<!-- TODO: 1.6 replace with real email before ship -->\n`;

const PLACEHOLDER_EMAIL = `[placeholder@example.com](mailto:placeholder@example.com)`;
const REAL_EMAIL = `[getsivkyle@gmail.com](mailto:getsivkyle@gmail.com)`;

async function main() {
  const { data, error } = await supabase
    .from("site_content")
    .select("markdown_body")
    .eq("key", "methodology_body")
    .single();

  if (error || !data) {
    console.error(
      "Could not fetch methodology_body:",
      error?.message ?? "row not found"
    );
    process.exit(1);
  }

  let body = data.markdown_body;
  let changes = 0;

  if (body.includes(INTRO_TODO)) {
    body = body.replace(INTRO_TODO, INTRO_REPLACEMENT);
    changes++;
  }
  if (body.includes(ESTIMATION_TODO)) {
    body = body.replace(ESTIMATION_TODO, ESTIMATION_REPLACEMENT);
    changes++;
  }
  if (body.includes(CHANGELOG_TODO_LINE)) {
    body = body.replace(CHANGELOG_TODO_LINE, "");
    changes++;
  }
  if (body.includes(PLACEHOLDER_EMAIL)) {
    body = body.replace(PLACEHOLDER_EMAIL, REAL_EMAIL);
    changes++;
  }
  if (body.includes(EMAIL_TODO_BLOCK)) {
    body = body.replace(EMAIL_TODO_BLOCK, "");
    changes++;
  }

  if (changes === 0) {
    console.log("No replacements needed; methodology_body already current.");
    return;
  }

  const { error: updateError } = await supabase
    .from("site_content")
    .update({ markdown_body: body })
    .eq("key", "methodology_body");

  if (updateError) {
    console.error("Failed to update methodology_body:", updateError.message);
    process.exit(1);
  }

  console.log(`Updated methodology_body: ${changes} replacement(s) applied.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
