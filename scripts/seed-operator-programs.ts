// scripts/seed-operator-programs.ts
// Module 3.1: seeds the competitive-landscape roster: new company rows,
// descriptive fields on existing companies, operator programs, and the
// company-role assignments per program. Facts verified 2026-08-15 (dev
// plan State of the world briefing). Operational snapshots come in 3.2.
//
// Idempotent: companies upserted on slug; programs upserted on slug;
// roles upserted on the composite pk.
//
// Run with: npx tsx scripts/seed-operator-programs.ts

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

// ---------------------------------------------------------------------------
// Companies: upsert on slug. Existing rows (waymo, tesla, zoox, pony-ai,
// weride, baidu-apollo) get their new descriptive fields; new rows are added.
// ---------------------------------------------------------------------------

const COMPANIES = [
  {
    slug: "waymo",
    display_name: "Waymo",
    founded_year: 2009,
    parent_company: "Alphabet",
    hq_country: "US",
    ownership: "Alphabet subsidiary; $16B round at $126B post-money, Feb 2026",
    status_summary:
      "The only US operator at national scale: roughly 500,000 paid weekly rides across 11 metros serving the public, four more in employee-only driverless operation.",
  },
  {
    slug: "zoox",
    display_name: "Zoox",
    founded_year: 2014,
    parent_company: "Amazon",
    hq_country: "US",
    ownership: "Amazon subsidiary",
    status_summary:
      "First paid rides August 10, 2026 in Las Vegas in a purpose-built vehicle with no steering wheel; free rides in SF and Austin; NHTSA exemption capped at 2,500 vehicles per year.",
  },
  {
    slug: "tesla",
    display_name: "Tesla",
    founded_year: 2003,
    parent_company: null,
    hq_country: "US",
    ownership: "Nasdaq: TSLA",
    status_summary:
      "Seven metros, but a very small unsupervised fleet; the Bay Area service uses a human driver and holds no California AV permits.",
  },
  {
    slug: "pony-ai",
    display_name: "Pony.ai",
    founded_year: 2016,
    parent_company: null,
    hq_country: "CN",
    ownership: "Nasdaq: PONY",
    status_summary:
      "Fully driverless commercial service in all four Chinese tier-one cities; 1,700+ vehicles heading to 3,500 by end 2026; expanding to Europe and the Middle East with Uber.",
  },
  {
    slug: "weride",
    display_name: "WeRide",
    founded_year: 2017,
    parent_company: null,
    hq_country: "CN",
    ownership: "Nasdaq: WRD",
    status_summary:
      "Roughly 1,800 robotaxis in China plus 400 overseas; fully driverless commercial service in Abu Dhabi and Dubai via Uber.",
  },
  {
    slug: "baidu-apollo",
    display_name: "Baidu Apollo Go",
    founded_year: 2017,
    parent_company: "Baidu",
    hq_country: "CN",
    ownership: "Baidu subsidiary (Nasdaq: BIDU)",
    status_summary:
      "3.2 million fully driverless rides in Q1 2026 across 27 cities, weekly peak above 350,000; commercial in Dubai; testing in Switzerland, London, Hong Kong.",
  },
  {
    slug: "nuro",
    display_name: "Nuro",
    founded_year: 2016,
    parent_company: null,
    hq_country: "US",
    ownership: "Private; $6B valuation (Series E, Aug 2025); Uber has committed roughly $500M",
    status_summary:
      "Pivoted from delivery robots to licensing the Nuro Driver in 2024; supplies the autonomy stack for Uber's premium robotaxi program on Lucid Gravity vehicles.",
  },
  {
    slug: "lucid",
    display_name: "Lucid",
    founded_year: 2007,
    parent_company: null,
    hq_country: "US",
    ownership: "Nasdaq: LCID; Uber holds about 11.5%",
    status_summary:
      "Supplies the Gravity SUV platform for Uber's robotaxi program; at least 35,000 vehicles committed; production units shipping from Arizona since July 2026.",
  },
  {
    slug: "uber",
    display_name: "Uber",
    founded_year: 2009,
    parent_company: null,
    hq_country: "US",
    ownership: "NYSE: UBER",
    status_summary:
      "The common network for most non-Waymo robotaxi deployments (30+ AV partnerships, AVs live in 7 cities); owns and operates the fleet in its Nuro plus Lucid program.",
  },
  {
    slug: "avride",
    display_name: "Avride",
    founded_year: 2024,
    parent_company: null,
    hq_country: "US",
    ownership: "Private (spun out of Yandex)",
    status_summary:
      "Commercial robotaxi service in Dallas on the Uber app since December 2025, safety operator onboard.",
  },
  {
    slug: "may-mobility",
    display_name: "May Mobility",
    founded_year: 2017,
    parent_company: null,
    hq_country: "US",
    ownership: "Private",
    status_summary:
      "Driver-out low-speed shared service in the Atlanta metro; Arlington, Texas on the Uber app.",
  },
  {
    slug: "motional",
    display_name: "Motional",
    founded_year: 2020,
    parent_company: "Hyundai",
    hq_country: "US",
    ownership: "Hyundai Motor Group",
    status_summary:
      "Supervised pilot in Las Vegas on the Uber app; driverless targeted end of 2026.",
  },
  {
    slug: "didi",
    display_name: "Didi Autonomous Driving",
    founded_year: 2016,
    parent_company: "Didi",
    hq_country: "CN",
    ownership: "Didi subsidiary",
    status_summary:
      "24/7 driverless trials in Guangzhou and Beijing demonstration zones; R2 vehicle rollout in 2026; UAE pilot announced.",
  },
];

// ---------------------------------------------------------------------------
// Programs and roles. Roles: av_developer, vehicle_platform, fleet_operator,
// network. Single-company programs hold all four themselves.
// ---------------------------------------------------------------------------

type Role = "av_developer" | "vehicle_platform" | "fleet_operator" | "network";
const ALL: Role[] = ["av_developer", "vehicle_platform", "fleet_operator", "network"];

interface Program {
  slug: string;
  display_name: string;
  lead: string; // company slug
  summary: string;
  roles: { company: string; roles: Role[] }[];
}

const PROGRAMS: Program[] = [
  {
    slug: "waymo-one",
    display_name: "Waymo One",
    lead: "waymo",
    summary:
      "Waymo's own-app service across 11 US metros serving the public; also reaches riders through Uber in Austin and Atlanta (exclusivity ending Jan 2028) and Lyft in Nashville.",
    roles: [
      { company: "waymo", roles: ALL },
      { company: "uber", roles: ["network"] },
    ],
  },
  {
    slug: "zoox",
    display_name: "Zoox",
    lead: "zoox",
    summary:
      "Purpose-built bidirectional robotaxi; paid in Las Vegas since Aug 10, 2026, free in SF and Austin.",
    roles: [{ company: "zoox", roles: ALL }],
  },
  {
    slug: "tesla-robotaxi",
    display_name: "Tesla Robotaxi",
    lead: "tesla",
    summary:
      "Model Y fleet in seven metros; unsupervised in Texas and Florida, human driver in the Bay Area; Cybercab production began Q2 2026.",
    roles: [{ company: "tesla", roles: ALL }],
  },
  {
    slug: "uber-nuro-lucid",
    display_name: "Uber premium robotaxi (Nuro + Lucid)",
    lead: "uber",
    summary:
      "Nuro Driver on Lucid Gravity SUVs, Uber-owned fleet; ~100 engineering vehicles testing with safety operators in the SF Bay Area and Houston; Bay Area launch targeted late 2026.",
    roles: [
      { company: "nuro", roles: ["av_developer"] },
      { company: "lucid", roles: ["vehicle_platform"] },
      { company: "uber", roles: ["fleet_operator", "network"] },
    ],
  },
  {
    slug: "apollo-go",
    display_name: "Baidu Apollo Go",
    lead: "baidu-apollo",
    summary:
      "The largest robotaxi operation by ride volume; 27 cities; RT6 vehicle at roughly $28K; Dubai commercial via Uber and its own app.",
    roles: [
      { company: "baidu-apollo", roles: ALL },
      { company: "uber", roles: ["network"] },
    ],
  },
  {
    slug: "pony-ai",
    display_name: "Pony.ai",
    lead: "pony-ai",
    summary:
      "Gen-7 fleet claiming city-level unit-economics breakeven in Guangzhou; commercial in Croatia, Qatar, Singapore, Korea; Europe expansion with Uber.",
    roles: [
      { company: "pony-ai", roles: ALL },
      { company: "uber", roles: ["network"] },
    ],
  },
  {
    slug: "weride",
    display_name: "WeRide",
    lead: "weride",
    summary:
      "Fully driverless commercial service in Abu Dhabi and Dubai on the Uber app; 1,200+ Middle East robotaxis committed with Uber.",
    roles: [
      { company: "weride", roles: ALL },
      { company: "uber", roles: ["network"] },
    ],
  },
  {
    slug: "avride",
    display_name: "Avride",
    lead: "avride",
    summary: "Dallas commercial service on the Uber app with a safety operator.",
    roles: [
      { company: "avride", roles: ["av_developer", "vehicle_platform", "fleet_operator"] },
      { company: "uber", roles: ["network"] },
    ],
  },
  {
    slug: "may-mobility",
    display_name: "May Mobility",
    lead: "may-mobility",
    summary: "Driver-out low-speed service in Atlanta metro; Arlington on Uber.",
    roles: [
      { company: "may-mobility", roles: ["av_developer", "vehicle_platform", "fleet_operator"] },
      { company: "uber", roles: ["network"] },
    ],
  },
  {
    slug: "motional",
    display_name: "Motional",
    lead: "motional",
    summary: "Supervised Las Vegas pilot on Uber; driverless targeted end 2026.",
    roles: [
      { company: "motional", roles: ["av_developer", "vehicle_platform", "fleet_operator"] },
      { company: "uber", roles: ["network"] },
    ],
  },
  {
    slug: "didi",
    display_name: "Didi Autonomous Driving",
    lead: "didi",
    summary: "Driverless trials in Guangzhou and Beijing; no commercial disclosures yet.",
    roles: [{ company: "didi", roles: ALL }],
  },
];

async function main() {
  // Companies
  const idBySlug = new Map<string, string>();
  for (const c of COMPANIES) {
    const { data, error } = await client
      .from("companies")
      .upsert(c, { onConflict: "slug" })
      .select("id, slug")
      .single();
    if (error || !data) {
      console.error(`FAIL company ${c.slug}:`, error?.message);
      process.exit(1);
    }
    idBySlug.set(data.slug, data.id);
    console.log(`OK company  ${c.slug}`);
  }

  // Programs and roles
  for (const p of PROGRAMS) {
    const leadId = idBySlug.get(p.lead);
    if (!leadId) {
      console.error(`FAIL program ${p.slug}: lead company ${p.lead} missing`);
      process.exit(1);
    }
    const { data: prog, error: progError } = await client
      .from("operator_programs")
      .upsert(
        { slug: p.slug, display_name: p.display_name, lead_company_id: leadId, summary: p.summary },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (progError || !prog) {
      console.error(`FAIL program ${p.slug}:`, progError?.message);
      process.exit(1);
    }

    for (const r of p.roles) {
      const cid = idBySlug.get(r.company);
      if (!cid) {
        console.error(`FAIL role ${p.slug}/${r.company}: company missing`);
        process.exit(1);
      }
      for (const role of r.roles) {
        const { error: roleError } = await client
          .from("operator_program_roles")
          .upsert(
            { program_id: prog.id, company_id: cid, role },
            { onConflict: "program_id,company_id,role" }
          );
        if (roleError) {
          console.error(`FAIL role ${p.slug}/${r.company}/${role}:`, roleError.message);
          process.exit(1);
        }
      }
    }
    console.log(`OK program  ${p.slug} (${p.roles.length} companies)`);
  }

  console.log(`\nDone. ${COMPANIES.length} companies, ${PROGRAMS.length} programs.`);
}

main();
