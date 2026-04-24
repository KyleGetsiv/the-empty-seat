// scripts/test-rls.ts
// Verifies that unauthenticated (anon key) writes are blocked by RLS.
// Run with: npx tsx scripts/test-rls.ts
//
// Expected outcome: INSERT fails with a policy violation error;
// SELECT succeeds and returns the seeded companies.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const client = createClient(url, anonKey);

async function main() {
  // --- 1. SELECT (should succeed) ---
  console.log("1. Testing anon SELECT on companies...");
  const { data: rows, error: selectError } = await client
    .from("companies")
    .select("slug, display_name");

  if (selectError) {
    console.error("   FAIL: SELECT returned error:", selectError.message);
  } else {
    console.log(`   PASS: SELECT returned ${rows?.length} rows`);
    rows?.forEach((r) => console.log(`         ${r.slug} — ${r.display_name}`));
  }

  // --- 2. INSERT (must fail) ---
  console.log("\n2. Testing anon INSERT into companies (must fail)...");
  const { error: insertError } = await client
    .from("companies")
    .insert({ slug: "rls-test", display_name: "RLS Test Co" });

  if (insertError) {
    console.log("   PASS: INSERT blocked —", insertError.message);
  } else {
    console.error("   FAIL: INSERT succeeded — RLS is NOT enforced!");
    process.exit(1);
  }
}

main();
