/**
 * Prepends the two-tier sourcing paragraph to the live methodology_body in
 * site_content. Safe to re-run: idempotent check prevents double-insertion.
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SENTINEL = "<!-- disclosed-source-paragraph -->";

const NEW_PARAGRAPH = `${SENTINEL}
The headline weekly rides figure on this site reflects Waymo's most recent company-wide disclosure, typically from press releases, investor letters, or executive statements. Other quantitative metrics (quarterly trips and vehicle miles traveled) reflect California Public Utilities Commission filings, which cover California operations only. The headline prioritizes currency and multi-market scope; the underlying metrics prioritize regulatory rigor and verifiability.

`;

async function main() {
  const { data, error } = await supabase
    .from("site_content")
    .select("markdown_body")
    .eq("key", "methodology_body")
    .single();

  if (error || !data) {
    console.error("Could not fetch methodology_body:", error?.message ?? "row not found");
    process.exit(1);
  }

  if (data.markdown_body.includes(SENTINEL)) {
    console.log("Paragraph already present; nothing to do.");
    return;
  }

  const updated = NEW_PARAGRAPH + data.markdown_body;

  const { error: upsertError } = await supabase
    .from("site_content")
    .update({ markdown_body: updated })
    .eq("key", "methodology_body");

  if (upsertError) {
    console.error("Failed to update methodology_body:", upsertError.message);
    process.exit(1);
  }

  console.log("Updated methodology_body: disclosed-source paragraph prepended.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
