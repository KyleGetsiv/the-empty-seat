// scripts/seed-competitor-snapshots.ts
// Module 3.2: one initial competitor_snapshots row per operator program,
// plus competitor city rows keyed to their program. Every figure verified
// against the cited source on 2026-08-15; disclosure_quality states how
// good each reading is. UNVERIFIED items from the research briefing are
// deliberately excluded (e.g. Zoox "350,000 passengers", Apollo Go total
// fleet size).
//
// REFRESH NOTE: Baidu (Apollo Go) and Pony.ai report Q2 2026 earnings on
// 2026-08-18. Their rows below carry Q1 2026 figures; add a fresh
// snapshot row via /admin/snapshots after the calls (or extend SNAPSHOTS
// and re-run: idempotent on (program_id, snapshot_date)).
//
// Run with: npx tsx scripts/seed-competitor-snapshots.ts

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

interface Src {
  url: string;
  publisher: string;
  title: string;
  published_at: string;
}

type Supervision = "driverless" | "safety_operator" | "mixed" | "human_is_legal_driver";
type Quality = "regulatory" | "company_disclosed" | "earnings_disclosed" | "press_reported" | "estimated";

interface Snapshot {
  program: string; // program slug
  snapshot_date: string;
  cities_serving_public: number | null;
  cities_operating_total: number | null;
  vehicle_count: number | null;
  weekly_rides: number | null;
  cumulative_rides: number | null;
  autonomous_miles_cumulative: number | null;
  funding_total_usd: number | null;
  implied_valuation_usd: number | null;
  supervision: Supervision | null;
  disclosure_quality: Quality;
  notes: string;
  source: Src;
}

const SNAPSHOTS: Snapshot[] = [
  {
    program: "waymo-one",
    snapshot_date: "2026-08-15",
    cities_serving_public: 11,
    cities_operating_total: 15,
    vehicle_count: 3000,
    weekly_rides: 500000,
    cumulative_rides: 20_000_000,
    autonomous_miles_cumulative: 127_000_000,
    funding_total_usd: 16_000_000_000,
    implied_valuation_usd: 126_000_000_000,
    supervision: "driverless",
    disclosure_quality: "company_disclosed",
    notes:
      "Weekly rides 500,000+ (Waymo, March 2026, reaffirmed April and July). Fleet 'about 3,000' per co-CEO Dolgov (March 2026); NHTSA recall filings show 3,791 as of May 2026. Cumulative 20M+ trips and 127M miles from the Feb 2026 funding blog; funding and valuation are the Feb 2026 round only, not lifetime raise. Cities: 11 serving public riders plus 4 employee-only driverless.",
    source: {
      url: "https://waymo.com/blog/2026/02/waymo-raises-usd16-billion-investment-round/",
      publisher: "Waymo",
      title: "Waymo raises $16 billion investment round",
      published_at: "2026-02-02",
    },
  },
  {
    program: "zoox",
    snapshot_date: "2026-08-15",
    cities_serving_public: 3,
    cities_operating_total: 4,
    vehicle_count: 105,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "driverless",
    disclosure_quality: "press_reported",
    notes:
      "Paid public rides in Las Vegas since Aug 10, 2026 (no waitlist); free waitlist-gated rides in San Francisco; free rides in Austin; Miami early access. Vehicle count 105 is the purpose-built fleet covered by the July 2026 software recall, used as a fleet proxy (Zoox does not disclose fleet size). Ride volumes not disclosed. NHTSA exemption (July 30, 2026) caps production at 2,500 vehicles per year for two years.",
    source: {
      url: "https://techcrunch.com/2026/08/05/zoox-to-start-charging-for-robotaxi-rides-in-las-vegas/",
      publisher: "TechCrunch",
      title: "Zoox to start charging for robotaxi rides in Las Vegas",
      published_at: "2026-08-05",
    },
  },
  {
    program: "tesla-robotaxi",
    snapshot_date: "2026-08-15",
    cities_serving_public: 7,
    cities_operating_total: 7,
    vehicle_count: 21,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: 380_000,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "mixed",
    disclosure_quality: "press_reported",
    notes:
      "Seven metros (Austin, Dallas, Houston, Miami, Orlando, Tampa, SF Bay Area) per Tesla's Q2 2026 call. Vehicle count 21 is the active UNSUPERVISED fleet at end of Q2 2026, derived by analysts from Tesla's own charts; 42 Model Ys registered in Texas; the Bay Area service uses a human driver under a TCP permit and files no California AV data. Autonomous miles = 380K+ cumulative unsupervised miles claimed by Tesla; ~2.5M cumulative paid miles including supervised. Q2 paid miles roughly flat vs Q1. No ride counts disclosed.",
    source: {
      url: "https://mlq.ai/news/tesla-robotaxi-paid-miles-stall-in-q2-as-fleet-shrinks-to-21-cars-despite-city-expansion/",
      publisher: "MLQ.ai",
      title: "Tesla robotaxi paid miles stall in Q2 as fleet shrinks to 21 cars despite city expansion",
      published_at: "2026-07-23",
    },
  },
  {
    program: "uber-nuro-lucid",
    snapshot_date: "2026-08-15",
    cities_serving_public: 0,
    cities_operating_total: 2,
    vehicle_count: 100,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: 1_000_000_000,
    implied_valuation_usd: null,
    supervision: "safety_operator",
    disclosure_quality: "company_disclosed",
    notes:
      "Nearly 100 Lucid Gravity engineering vehicles with Nuro Driver testing autonomously with safety operators in the SF Bay Area (since Dec 2025) and Houston (confirmed June 2026); Uber employees hailing via the Uber app since April 13, 2026. No public rides, no fares. Driverless testing not yet begun as of June reporting. Funding figure = Uber's $500M in Lucid plus roughly $500M committed to Nuro (Reuters); at least 35,000 vehicles committed. Bay Area launch targeted late 2026, Houston mid-2027.",
    source: {
      url: "https://ir.lucidmotors.com/news-releases/news-release-details/lucid-announces-operational-reset-and-second-quarter-2026",
      publisher: "Lucid",
      title: "Lucid announces operational reset and second quarter 2026 results",
      published_at: "2026-08-04",
    },
  },
  {
    program: "apollo-go",
    snapshot_date: "2026-05-18",
    cities_serving_public: 27,
    cities_operating_total: 27,
    vehicle_count: null,
    weekly_rides: 350000,
    cumulative_rides: 22_000_000,
    autonomous_miles_cumulative: 205_000_000,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "driverless",
    disclosure_quality: "earnings_disclosed",
    notes:
      "Q1 2026 (Baidu earnings, May 18, 2026): 3.2M fully driverless rides in the quarter, weekly peak above 350,000 in March, 22M cumulative rides as of April, 27 cities. Miles: 330M+ autonomous km cumulative (~205M miles). Total fleet not disclosed. Wuhan operations resumed July 2026 WITH safety drivers after the March 31 mass outage; nationwide new-permit freeze April to late July. REFRESH after Q2 2026 earnings on 2026-08-18.",
    source: {
      url: "https://ir.baidu.com/news-releases/news-release-details/baidu-announces-first-quarter-2026-results/",
      publisher: "Baidu",
      title: "Baidu announces first quarter 2026 results",
      published_at: "2026-05-18",
    },
  },
  {
    program: "pony-ai",
    snapshot_date: "2026-05-26",
    cities_serving_public: 20,
    cities_operating_total: 20,
    vehicle_count: 1700,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "mixed",
    disclosure_quality: "earnings_disclosed",
    notes:
      "Q1 2026 (May 26, 2026): fleet 1,700+ (target 3,500+ by end 2026), 20+ cities across 9 countries, robotaxi revenue RMB 59M (+395% YoY). Fully driverless commercial in all four Chinese tier-one cities; overseas services mostly with safety operators (Zagreb, Doha, Singapore, Seoul), hence 'mixed'. Claims Gen-7 city-level unit-economics breakeven in Guangzhou. REFRESH after Q2 2026 earnings on 2026-08-18.",
    source: {
      url: "https://autonews.gasgoo.com/articles/news/ponyai-raises-2026-robotaxi-targets-after-record-quarterly-revenue-2059470593563594753",
      publisher: "Gasgoo",
      title: "Pony.ai raises 2026 robotaxi targets after record quarterly revenue",
      published_at: "2026-05-27",
    },
  },
  {
    program: "weride",
    snapshot_date: "2026-08-12",
    cities_serving_public: null,
    cities_operating_total: null,
    vehicle_count: 2200,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "mixed",
    disclosure_quality: "earnings_disclosed",
    notes:
      "Q2 2026 (Aug 12, 2026): ~1,800 robotaxis in China plus ~400 overseas (Middle East 200+); ~3,400 L4 vehicles total including robobuses. Fully driverless commercial in Abu Dhabi and Dubai (via Uber); Riyadh with safety operators, hence 'mixed'. 21+ average daily rides per vehicle in Guangzhou. City count spans 60+ cities across all business lines, so left null for robotaxi specifically. Revenue RMB 231.7M (+82% YoY).",
    source: {
      url: "https://kr-asia.com/werides-two-growth-drivers-accelerate-as-global-robotaxi-expansion-gathers-pace",
      publisher: "KrASIA",
      title: "WeRide's two growth drivers accelerate as global robotaxi expansion gathers pace",
      published_at: "2026-08-14",
    },
  },
  {
    program: "avride",
    snapshot_date: "2026-08-01",
    cities_serving_public: 1,
    cities_operating_total: 1,
    vehicle_count: 317,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "safety_operator",
    disclosure_quality: "press_reported",
    notes:
      "Commercial service in Dallas on the Uber app since December 2025, ~9 sq mi zone, safety operator onboard, UberX/Comfort pricing. Vehicle count 317 = Texas AV registrations (May 28, 2026 TxDMV tracker), a registration proxy, not an operating count.",
    source: {
      url: "https://thechargeport.com/robotaxi-tracker",
      publisher: "The Charge Port",
      title: "Robotaxi tracker (verified 2026-08-01)",
      published_at: "2026-08-01",
    },
  },
  {
    program: "may-mobility",
    snapshot_date: "2026-08-01",
    cities_serving_public: 2,
    cities_operating_total: 2,
    vehicle_count: null,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "mixed",
    disclosure_quality: "press_reported",
    notes:
      "Driver-out low-speed shared service in Peachtree Corners (Atlanta metro); Arlington, Texas on the Uber app. Fleet and ride volumes not disclosed.",
    source: {
      url: "https://thechargeport.com/robotaxi-tracker",
      publisher: "The Charge Port",
      title: "Robotaxi tracker (verified 2026-08-01)",
      published_at: "2026-08-01",
    },
  },
  {
    program: "motional",
    snapshot_date: "2026-08-01",
    cities_serving_public: 1,
    cities_operating_total: 1,
    vehicle_count: null,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "safety_operator",
    disclosure_quality: "press_reported",
    notes:
      "Supervised pilot in Las Vegas on the Uber app; driverless targeted end of 2026. Fleet not disclosed.",
    source: {
      url: "https://thechargeport.com/robotaxi-tracker",
      publisher: "The Charge Port",
      title: "Robotaxi tracker (verified 2026-08-01)",
      published_at: "2026-08-01",
    },
  },
  {
    program: "didi",
    snapshot_date: "2026-04-15",
    cities_serving_public: 0,
    cities_operating_total: 2,
    vehicle_count: null,
    weekly_rides: null,
    cumulative_rides: null,
    autonomous_miles_cumulative: null,
    funding_total_usd: null,
    implied_valuation_usd: null,
    supervision: "driverless",
    disclosure_quality: "press_reported",
    notes:
      "24/7 fully driverless trials in Guangzhou and Beijing demonstration zones (Dec 2025 onward); R2 vehicle first fleet delivered Jan 2026; UAE pilot announced. No fleet, ride, or revenue disclosures.",
    source: {
      url: "https://autonews.gasgoo.com/articles/news/didi-to-launch-robotaxi-pilot-operations-in-the-uae-this-year-2044385301797969921",
      publisher: "Gasgoo",
      title: "Didi to launch robotaxi pilot operations in the UAE this year",
      published_at: "2026-04-15",
    },
  },
];

// ---------------------------------------------------------------------------
// Competitor cities, keyed to program (company_id = lead company). Waymo's
// cities already exist and stay program_id = null.
// ---------------------------------------------------------------------------

interface CityRow {
  program: string;
  company: string;
  name: string;
  metro_area: string;
  country: string;
  launch_date: string | null;
  public_access_date: string | null;
  status: "announced" | "waitlist" | "employee" | "public" | "paused";
  latitude: number;
  longitude: number;
  notes: string;
}

const CITIES: CityRow[] = [
  // Zoox
  { program: "zoox", company: "zoox", name: "Las Vegas", metro_area: "Las Vegas Valley", country: "US", launch_date: "2025-09-10", public_access_date: "2026-08-10", status: "public", latitude: 36.1147, longitude: -115.1728, notes: "Free public rides from Sept 10, 2025; paid service from Aug 10, 2026 via Zoox app, no waitlist. Strip, LVCC, Sphere, T-Mobile Arena, Harry Reid airport." },
  { program: "zoox", company: "zoox", name: "San Francisco", metro_area: "San Francisco Bay Area", country: "US", launch_date: "2025-11-18", public_access_date: null, status: "waitlist", latitude: 37.7749, longitude: -122.4194, notes: "Free rides, waitlist-gated (Zoox Explorers) since Nov 18, 2025; footprint roughly quadrupled spring 2026. Paid service needs CPUC/DMV deployment permits Zoox does not yet hold." },
  { program: "zoox", company: "zoox", name: "Austin", metro_area: "Austin Metro", country: "US", launch_date: "2026-03-24", public_access_date: null, status: "waitlist", latitude: 30.2672, longitude: -97.7431, notes: "Free rides; began with employees and families, public waitlist opening; full public access targeted end of 2026." },
  { program: "zoox", company: "zoox", name: "Miami", metro_area: "Miami Metro", country: "US", launch_date: null, public_access_date: null, status: "announced", latitude: 25.7617, longitude: -80.1918, notes: "Early access and testing; public service planned by end of 2026." },
  // Tesla
  { program: "tesla-robotaxi", company: "tesla", name: "Austin", metro_area: "Austin Metro", country: "US", launch_date: "2025-06-22", public_access_date: "2025-06-22", status: "public", latitude: 30.2672, longitude: -97.7431, notes: "Launched with safety monitors June 22, 2025; first no-monitor public rides Jan 22, 2026; broader monitor removal and geofence expansion June 2026. Mixed supervised and unsupervised." },
  { program: "tesla-robotaxi", company: "tesla", name: "Dallas", metro_area: "Dallas-Fort Worth", country: "US", launch_date: "2026-04-15", public_access_date: "2026-04-15", status: "public", latitude: 32.7767, longitude: -96.797, notes: "Unsupervised. Launch date approximate (April to June 2026 per sources)." },
  { program: "tesla-robotaxi", company: "tesla", name: "Houston", metro_area: "Houston Metro", country: "US", launch_date: "2026-04-15", public_access_date: "2026-04-15", status: "public", latitude: 29.7604, longitude: -95.3698, notes: "Unsupervised. Launch date approximate (April to June 2026 per sources)." },
  { program: "tesla-robotaxi", company: "tesla", name: "Miami", metro_area: "Miami Metro", country: "US", launch_date: "2026-05-01", public_access_date: "2026-05-01", status: "public", latitude: 25.7617, longitude: -80.1918, notes: "Unsupervised. Launch date approximate (Q2 2026)." },
  { program: "tesla-robotaxi", company: "tesla", name: "Orlando", metro_area: "Orlando Metro", country: "US", launch_date: "2026-07-20", public_access_date: "2026-07-20", status: "public", latitude: 28.5383, longitude: -81.3792, notes: "Unsupervised; launched week of July 20, 2026." },
  { program: "tesla-robotaxi", company: "tesla", name: "Tampa", metro_area: "Tampa Bay", country: "US", launch_date: "2026-07-20", public_access_date: "2026-07-20", status: "public", latitude: 27.9506, longitude: -82.4572, notes: "Unsupervised; launched week of July 20, 2026." },
  { program: "tesla-robotaxi", company: "tesla", name: "San Francisco Bay Area", metro_area: "San Francisco Bay Area", country: "US", launch_date: "2025-07-31", public_access_date: "2025-07-31", status: "public", latitude: 37.7749, longitude: -122.4194, notes: "Human driver in every car under a TCP charter permit; CPUC states the person in the car is the driver. Not an AV service under California law; no AV data filed." },
  // Nuro / Lucid / Uber
  { program: "uber-nuro-lucid", company: "uber", name: "San Francisco Bay Area", metro_area: "San Francisco Bay Area", country: "US", launch_date: "2025-12-01", public_access_date: null, status: "employee", latitude: 37.4419, longitude: -122.143, notes: "Engineering fleet testing autonomously with safety operators since Dec 2025; Uber employees hailing via Uber app since April 13, 2026. DMV driverless permit covers Santa Clara and San Mateo counties (not SF proper). Public launch targeted late 2026." },
  { program: "uber-nuro-lucid", company: "uber", name: "Houston", metro_area: "Houston Metro", country: "US", launch_date: "2026-04-01", public_access_date: null, status: "announced", latitude: 29.7604, longitude: -95.3698, notes: "Engineering fleet testing with safety operators (Houston Heights) since spring 2026; service targeted mid-2027 with a 50K sq ft depot." },
  // Apollo Go (international commercial highlights)
  { program: "apollo-go", company: "baidu-apollo", name: "Wuhan", metro_area: "Wuhan", country: "CN", launch_date: "2022-08-08", public_access_date: "2022-08-08", status: "public", latitude: 30.5928, longitude: 114.3055, notes: "Largest single Apollo Go market. Mass outage March 31, 2026 (~100 vehicles frozen); resumed July 2026 with safety drivers." },
  { program: "apollo-go", company: "baidu-apollo", name: "Dubai", metro_area: "Dubai", country: "AE", launch_date: "2026-03-30", public_access_date: "2026-03-30", status: "public", latitude: 25.2048, longitude: 55.2708, notes: "Commercial fully driverless since March 30, 2026 via Apollo Go and Uber apps; RTA phased rollout with Dubai Taxi Company." },
  { program: "apollo-go", company: "baidu-apollo", name: "Abu Dhabi", metro_area: "Abu Dhabi", country: "AE", launch_date: "2025-11-15", public_access_date: null, status: "waitlist", latitude: 24.4539, longitude: 54.3773, notes: "Fully driverless commercial permit with AutoGo (Nov 2025); scaling to hundreds of vehicles by 2026." },
  { program: "apollo-go", company: "baidu-apollo", name: "St. Gallen", metro_area: "Eastern Switzerland", country: "CH", launch_date: "2026-06-01", public_access_date: null, status: "employee", latitude: 47.4245, longitude: 9.3767, notes: "AmiGo with PostBus; Level 4 permit; safety operators onboard; public bookable service targeted 2027." },
  { program: "apollo-go", company: "baidu-apollo", name: "London", metro_area: "Greater London", country: "GB", launch_date: "2026-07-28", public_access_date: null, status: "employee", latitude: 51.5074, longitude: -0.1278, notes: "Road testing with safety operators from July 28, 2026 (Freenow by Lyft in Brent; Uber partnership); public rides not before 2027." },
  // Pony.ai
  { program: "pony-ai", company: "pony-ai", name: "Guangzhou", metro_area: "Guangzhou", country: "CN", launch_date: "2023-04-01", public_access_date: "2023-04-01", status: "public", latitude: 23.1291, longitude: 113.2644, notes: "First fully driverless commercial permit April 2023; Gen-7 city-level unit-economics breakeven claimed Nov 2025." },
  { program: "pony-ai", company: "pony-ai", name: "Shenzhen", metro_area: "Shenzhen", country: "CN", launch_date: "2025-10-31", public_access_date: "2025-10-31", status: "public", latitude: 22.5431, longitude: 114.0579, notes: "First citywide fully driverless commercial permit, Oct 31, 2025." },
  { program: "pony-ai", company: "pony-ai", name: "Zagreb", metro_area: "Zagreb", country: "HR", launch_date: "2026-05-01", public_access_date: "2026-05-01", status: "public", latitude: 45.815, longitude: 15.9819, notes: "Europe's first commercial robotaxi service (May 2026); Uber integration planned; safety operators." },
  // WeRide
  { program: "weride", company: "weride", name: "Abu Dhabi", metro_area: "Abu Dhabi", country: "AE", launch_date: "2024-12-01", public_access_date: "2024-12-01", status: "public", latitude: 24.4539, longitude: 54.3773, notes: "Commercial with Uber since Dec 2024; fully driverless since the Oct 2025 permit; claims unit-economics breakeven after removing safety officers." },
  { program: "weride", company: "weride", name: "Dubai", metro_area: "Dubai", country: "AE", launch_date: "2026-03-31", public_access_date: "2026-03-31", status: "public", latitude: 25.2048, longitude: 55.2708, notes: "Fully driverless fare-charging via the Uber app from March 31, 2026 (Jumeirah, Umm Suqeim); 8 more districts planned." },
  { program: "weride", company: "weride", name: "Riyadh", metro_area: "Riyadh", country: "SA", launch_date: "2025-10-24", public_access_date: "2025-10-24", status: "public", latitude: 24.7136, longitude: 46.6753, notes: "With Uber since Oct 2025; safety operators; fixed routes; driverless transition planned." },
  { program: "weride", company: "weride", name: "Guangzhou", metro_area: "Guangzhou", country: "CN", launch_date: "2022-06-01", public_access_date: "2022-06-01", status: "public", latitude: 23.1291, longitude: 113.2644, notes: "300+ robotaxis fully driverless 24/7." },
  // Avride, May, Motional
  { program: "avride", company: "avride", name: "Dallas", metro_area: "Dallas-Fort Worth", country: "US", launch_date: "2025-12-01", public_access_date: "2025-12-01", status: "public", latitude: 32.7767, longitude: -96.797, notes: "Commercial on Uber app since Dec 2025, ~9 sq mi, safety operator onboard." },
  { program: "may-mobility", company: "may-mobility", name: "Atlanta", metro_area: "Atlanta Metro", country: "US", launch_date: "2025-09-01", public_access_date: "2025-09-01", status: "public", latitude: 33.9698, longitude: -84.2214, notes: "Driver-out low-speed shared service in Peachtree Corners." },
  { program: "may-mobility", company: "may-mobility", name: "Arlington", metro_area: "Dallas-Fort Worth", country: "US", launch_date: "2025-12-01", public_access_date: "2025-12-01", status: "public", latitude: 32.7357, longitude: -97.1081, notes: "On the Uber app." },
  { program: "motional", company: "motional", name: "Las Vegas", metro_area: "Las Vegas Valley", country: "US", launch_date: "2025-12-01", public_access_date: "2025-12-01", status: "public", latitude: 36.1699, longitude: -115.1398, notes: "Supervised pilot on the Uber app; driverless targeted end 2026." },
];

async function findOrCreateSource(s: Src): Promise<string> {
  const { data: existing } = await client.from("sources").select("id").eq("url", s.url).maybeSingle();
  if (existing) return existing.id as string;
  const { data: created, error } = await client
    .from("sources")
    .insert({ url: s.url, publisher: s.publisher, title: s.title, published_at: s.published_at + "T00:00:00Z" })
    .select("id")
    .single();
  if (error || !created) throw new Error(`source insert failed: ${error?.message}`);
  return created.id as string;
}

async function main() {
  const { data: programs } = await client.from("operator_programs").select("id, slug");
  const { data: companies } = await client.from("companies").select("id, slug");
  const progId = new Map((programs ?? []).map((p) => [p.slug, p.id]));
  const compId = new Map((companies ?? []).map((c) => [c.slug, c.id]));

  let snaps = 0;
  for (const s of SNAPSHOTS) {
    const pid = progId.get(s.program);
    if (!pid) {
      console.error(`FAIL snapshot ${s.program}: program not found (run seed-operator-programs.ts first)`);
      process.exit(1);
    }
    const sourceId = await findOrCreateSource(s.source);
    const { error } = await client.from("competitor_snapshots").upsert(
      {
        program_id: pid,
        snapshot_date: s.snapshot_date,
        cities_serving_public: s.cities_serving_public,
        cities_operating_total: s.cities_operating_total,
        vehicle_count: s.vehicle_count,
        weekly_rides: s.weekly_rides,
        cumulative_rides: s.cumulative_rides,
        autonomous_miles_cumulative: s.autonomous_miles_cumulative,
        funding_total_usd: s.funding_total_usd,
        implied_valuation_usd: s.implied_valuation_usd,
        supervision: s.supervision,
        disclosure_quality: s.disclosure_quality,
        source_id: sourceId,
        notes: s.notes,
      },
      { onConflict: "program_id,snapshot_date" }
    );
    if (error) {
      console.error(`FAIL snapshot ${s.program}:`, error.message);
      process.exit(1);
    }
    console.log(`OK snapshot ${s.program.padEnd(18)} ${s.snapshot_date} [${s.disclosure_quality}]`);
    snaps++;
  }

  let cities = 0;
  for (const c of CITIES) {
    const pid = progId.get(c.program);
    const cid = compId.get(c.company);
    if (!pid || !cid) {
      console.error(`FAIL city ${c.program}/${c.name}: program or company missing`);
      process.exit(1);
    }
    const { error } = await client.from("cities").upsert(
      {
        company_id: cid,
        program_id: pid,
        name: c.name,
        metro_area: c.metro_area,
        country: c.country,
        launch_date: c.launch_date,
        public_access_date: c.public_access_date,
        status: c.status,
        latitude: c.latitude,
        longitude: c.longitude,
        notes: c.notes,
      },
      { onConflict: "company_id,name" }
    );
    if (error) {
      console.error(`FAIL city ${c.program}/${c.name}:`, error.message);
      process.exit(1);
    }
    cities++;
  }
  console.log(`OK cities   ${cities} competitor city rows upserted`);

  console.log(`\nDone. ${snaps} snapshots, ${cities} cities.`);
  console.log("REMINDER: refresh Apollo Go and Pony.ai after Q2 2026 earnings (2026-08-18).");
}

main();
