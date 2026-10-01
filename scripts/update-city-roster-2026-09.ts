// scripts/update-city-roster-2026-09.ts
// Section 0 (dev plan v3) freshness catch-up: Waymo roster changes between
// 2026-08-20 and 2026-09-30, each verified on 2026-09-30 against Waymo's own
// blog or Help Center announcements (cited in the appended note).
//
// Status semantics (schema.md): 'waitlist' = carrying public riders by
// invitation; launch_date = when public riders began; public_access_date =
// when anyone could ride. The employee cohort was seeded in 2.4 with
// launch_date = the July 8 employee-operations start; moving to 'waitlist'
// sets launch_date to the first public-rider date, which is what the field
// means. The employee-operations date survives in the note.
//
// Idempotent: updates by (company_id, name); a note is appended only if it is
// not already present. Writes straight to the database, so the homepage and
// /landscape show the change only after ISR or an admin save on /admin/cities.
//
// Run with: npx tsx scripts/update-city-roster-2026-09.ts

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

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const THREE_CITIES =
  "Employee-only driverless operations from July 8, 2026; public riders by invitation from September 1, 2026, opening to everyone over time (waymo.com/blog/2026/09/ride-in-denver-san-diego-tampa).";

const UPDATES: Record<string, { fields: Record<string, unknown>; note: string }> = {
  Denver: { fields: { status: "waitlist", launch_date: "2026-09-01", public_access_date: null }, note: THREE_CITIES },
  "San Diego": { fields: { status: "waitlist", launch_date: "2026-09-01", public_access_date: null }, note: THREE_CITIES },
  Tampa: { fields: { status: "waitlist", launch_date: "2026-09-01", public_access_date: null }, note: THREE_CITIES },
  "Las Vegas": {
    fields: { status: "waitlist", launch_date: "2026-09-14", public_access_date: null },
    note: "Employee-only driverless operations from July 8, 2026; public riders on a rolling invitation basis from September 14, 2026, Ojai vehicles (waymo.com/blog/2026/09/ride-in-las-vegas).",
  },
  Houston: {
    fields: { status: "public", public_access_date: "2026-08-20" },
    note: "Waitlist dropped August 20, 2026: 'anyone can download the app and ride in Houston' (support.google.com/waymo/answer/17597360).",
  },
  "San Antonio": {
    // Status unchanged: the relaunch serves riders who already had access, new users by waitlist.
    fields: {},
    note: "Service paused after an unoccupied vehicle was swept into floodwater on April 21, 2026; resumed September 17, 2026 for riders who already had access, waitlisted riders admitted over time (Axios San Antonio, KSAT, 2026-09-17). The roster read 'waitlist' throughout the pause because nothing re-checked it.",
  },
};

async function main() {
  const { data: waymo, error: companyError } = await client.from("companies").select("id").eq("slug", "waymo").single();
  if (companyError || !waymo) {
    console.error("Could not find Waymo company row:", companyError?.message);
    process.exit(1);
  }

  let updated = 0;
  for (const [name, { fields, note }] of Object.entries(UPDATES)) {
    const { data: row, error: readError } = await client
      .from("cities")
      .select("id, status, launch_date, public_access_date, notes")
      .eq("company_id", waymo.id)
      .eq("name", name)
      .maybeSingle();
    if (readError) {
      console.error(`FAIL read ${name}:`, readError.message);
      process.exit(1);
    }
    if (!row) {
      console.warn(`WARN ${name}: no Waymo row with this name, skipped`);
      continue;
    }
    const notes = (row.notes ?? "").includes(note) ? row.notes : [row.notes, note].filter(Boolean).join(" ");
    const { error } = await client.from("cities").update({ ...fields, notes }).eq("id", row.id);
    if (error) {
      console.error(`FAIL update ${name}:`, error.message);
      process.exit(1);
    }
    console.log(
      `OK ${name.padEnd(12)} ${row.status} -> ${fields.status ?? row.status}; launch ${row.launch_date} -> ${fields.launch_date ?? row.launch_date}; public ${row.public_access_date} -> ${"public_access_date" in fields ? fields.public_access_date : row.public_access_date}`
    );
    updated++;
  }
  console.log(`\nDone. ${updated} updated. Wrote straight to the database: pages update after ISR or an admin save.`);
}

main();
