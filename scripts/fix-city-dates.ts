// scripts/fix-city-dates.ts
// One-off correction (fix(2.4)) for two Waymo city rows whose launch and
// public-access dates were collapsed into one, found on 2026-08-16 when the
// roster was spot-checked against waymo.com.
//
// The schema models these as two distinct events, and the Bay Area row uses
// them correctly: launch_date is when the service began carrying public
// riders (the waitlist era), public_access_date is when the waitlist was
// dropped. Two rows lost that distinction:
//
//  1. Nashville has public_access_date 2026-04-07, the same as launch_date.
//     April 7 was the waitlist launch: "we begin inviting riders on a rolling
//     basis... access codes to skip the line". Waymo opened it to everyone on
//     2026-06-25 ("Starting today, anyone can download the app and ride in
//     Nashville, no invite code required").
//  2. Los Angeles has launch_date 2024-11-12, which is the date the waitlist
//     was dropped, not the date service began. Waymo started carrying public
//     riders in LA on 2024-03-14 ("available to select members of the public",
//     gradually onboarding "more than 50,000 people on our LA waitlist").
//     Collapsing these hides an eight-month waitlist period that grew to
//     300,000 people before it opened.
//
// Both distort CityLaunchTimeline, which orders and labels from these dates.
//
// Not a defect, checked and left alone: Phoenix, Austin and Atlanta all have
// launch_date == public_access_date legitimately. Phoenix 2020-10-08 is the
// day the fully driverless service opened to the general public with no
// waitlist (the 2018 Waymo One launch ran with safety drivers, so it is not
// this site's starting point). Austin and Atlanta launched inside the Uber
// app, open to every Uber user from day one, with no Waymo waitlist.
//
// Idempotent: each row is updated only when its stored value differs.
// Dry run by default; pass --apply to write.
//   npx tsx scripts/fix-city-dates.ts
//   npx tsx scripts/fix-city-dates.ts --apply

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Correction {
  city: string;
  field: "launch_date" | "public_access_date";
  from: string;
  to: string;
  because: string;
  source: string;
}

const CORRECTIONS: Correction[] = [
  {
    city: "Nashville",
    field: "public_access_date",
    from: "2026-04-07",
    to: "2026-06-25",
    because: "April 7 was the waitlist launch, not open access",
    source: "https://support.google.com/waymo/answer/17200563",
  },
  {
    city: "Los Angeles",
    field: "launch_date",
    from: "2024-11-12",
    to: "2024-03-14",
    because: "Nov 12 is when the waitlist was dropped; service began Mar 14",
    source: "https://waymo.com/blog/2024/03/scaling-waymo-one-safely-across-four-cities-this-year/",
  },
];

let planned = 0;
let skipped = 0;

async function main() {
  const { data: waymo, error: companyError } = await client
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();
  if (companyError || !waymo) {
    console.error("Could not find Waymo company row:", companyError?.message);
    process.exit(1);
    return;
  }
  const waymoId = waymo.id;

  console.log(`\n${APPLY ? "Applying" : "Dry run"} — fix(2.4) city date corrections\n`);

  for (const c of CORRECTIONS) {
    const { data: row } = await client
      .from("cities")
      .select("id, name, launch_date, public_access_date, notes")
      .eq("company_id", waymoId)
      .eq("name", c.city)
      .maybeSingle();

    if (!row) {
      console.error(`  SKIP   ${c.city}: no row found`);
      continue;
    }
    const current = row[c.field];
    if (current === c.to) {
      skipped++;
      console.log(`  ok     ${c.city}.${c.field} already ${c.to}`);
      continue;
    }
    if (current !== c.from) {
      // Someone changed it since the spot-check. Refuse rather than
      // overwrite a value this script was not written against.
      console.error(`  SKIP   ${c.city}.${c.field} is ${current}, expected ${c.from}; not overwriting`);
      continue;
    }

    planned++;
    console.log(`  ${APPLY ? "APPLY" : "PLAN "}  ${c.city}.${c.field}: ${c.from} -> ${c.to} (${c.because})`);

    const marker = `Date corrected 2026-08-19: ${c.field} ${c.to}, per ${c.source}.`;
    const notes = row.notes && row.notes.includes(marker) ? row.notes : [row.notes, marker].filter(Boolean).join(" ");

    if (APPLY) {
      const { error } = await client
        .from("cities")
        .update({ [c.field]: c.to, notes })
        .eq("id", row.id);
      if (error) throw new Error(`Failed to update ${c.city}: ${error.message}`);
    }
  }

  // --- verification --------------------------------------------------------
  // Cities where the two dates are identical. Three are legitimate (Phoenix
  // opened with no waitlist; Austin and Atlanta launched inside the Uber app),
  // so this is a watch list, not a failure list: a NEW name appearing here is
  // the signal that another waitlist period has been collapsed.
  console.log("\nCities where launch_date == public_access_date (expected: Phoenix, Austin, Atlanta)");
  const { data: all } = await client
    .from("cities")
    .select("name, status, launch_date, public_access_date")
    .eq("company_id", waymoId)
    .not("public_access_date", "is", null)
    .order("launch_date", { ascending: true });
  for (const row of all ?? []) {
    if (row.launch_date === row.public_access_date) {
      console.log(`  ${row.name} (${row.status}) — both ${row.launch_date}`);
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Planned"} ${planned} change(s); ${skipped} already correct.` +
      (APPLY
        ? "\nCities feed the homepage and /landscape, and this wrote straight to the database,\nso ISR will serve the old timeline until it revalidates or an admin mutation runs.\n"
        : "\nRe-run with --apply to write.\n")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
