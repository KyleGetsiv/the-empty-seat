export interface GlossaryEntry {
  term: string;
  shortDefinition: string;
  longDefinition?: string;
  seeAlso?: string[];
}

export const glossary: Record<string, GlossaryEntry> = {
  disengagement_rate: {
    term: "Disengagement Rate",
    shortDefinition:
      "The frequency at which a human driver must take control from an autonomous system, expressed per thousand miles driven.",
    longDefinition:
      "Reported annually to the California DMV for vehicles tested in the state. A lower rate indicates greater system reliability, though the metric is imperfect: reporting definitions vary by company, and the difficulty of miles (urban vs. highway) is not normalized.",
    seeAlso: ["autonomous_miles", "safety_driver"],
  },
  contribution_margin: {
    term: "Contribution Margin",
    shortDefinition:
      "Revenue minus variable costs per ride. The per-unit profit before fixed costs are allocated.",
    longDefinition:
      "For a robotaxi, variable costs include energy, remote assist labor, and incremental maintenance. Contribution margin turns positive before a vehicle has paid back its capital cost. It is a key indicator of whether unit economics are on a path to profitability.",
    seeAlso: ["unit_economics", "capex_intensity"],
  },
  autonomous_miles: {
    term: "Autonomous Miles",
    shortDefinition:
      "Miles driven by a vehicle under autonomous software control, with or without a safety driver present.",
    longDefinition:
      "The primary measure of a robotaxi program's operational scale. Waymo reports cumulative autonomous miles periodically; the California DMV compiles annual figures from all permitted operators. Not all autonomous miles carry passengers: some are mapping runs or empty repositioning trips.",
    seeAlso: ["rider_only_miles", "disengagement_rate"],
  },
  rider_only_miles: {
    term: "Rider-Only Miles",
    shortDefinition:
      "Miles driven autonomously with a paying passenger and no safety driver in the vehicle.",
    longDefinition:
      "The most commercially significant subset of autonomous miles. Rider-only operations are the end state of a fully commercial robotaxi: no labor cost in the vehicle. Waymo began rider-only service in Phoenix in 2020 and has since expanded to San Francisco and other markets.",
    seeAlso: ["autonomous_miles", "safety_driver"],
  },
  remote_assist: {
    term: "Remote Assist",
    shortDefinition:
      "A human operator who monitors autonomous vehicles remotely and can intervene in edge cases without being physically present.",
    longDefinition:
      "Remote assist is a key variable cost in robotaxi unit economics. The ratio of remote assist workers to vehicles determines labor cost per ride. As systems improve, one worker can oversee more vehicles simultaneously, improving the ratio and reducing per-ride cost.",
    seeAlso: ["contribution_margin", "unit_economics"],
  },
  safety_driver: {
    term: "Safety Driver",
    shortDefinition:
      "A human driver seated in the vehicle during autonomous operation, able to take control immediately.",
    longDefinition:
      "Safety drivers are required during early development and testing phases. Their presence adds significant labor cost and limits scalability. Transitioning to rider-only (driverless) operation is the critical step from a cost structure perspective.",
    seeAlso: ["rider_only_miles", "disengagement_rate"],
  },
  service_area: {
    term: "Service Area",
    shortDefinition:
      "The geographic zone within which a robotaxi can pick up and drop off passengers.",
    longDefinition:
      "Service areas are defined by the operational design domain of the autonomous system: the conditions (geography, weather, road types) it is certified to handle. Expanding the service area typically requires additional mapping, validation, and regulatory approval.",
    seeAlso: ["odd", "autonomous_miles"],
  },
  odd: {
    term: "ODD (Operational Design Domain)",
    shortDefinition:
      "The specific conditions under which an autonomous driving system is designed to operate.",
    longDefinition:
      "ODD defines the boundaries of a system's competence: geographic area, weather conditions, road types, speed ranges, and time of day. Operating outside the ODD is not permitted. Expanding the ODD is a primary technical goal for AV companies.",
    seeAlso: ["service_area"],
  },
  waymo_driver_gen6: {
    term: "6th-Generation Waymo Driver",
    shortDefinition:
      "Waymo's current autonomous driving system, first deployed commercially in 2023.",
    longDefinition:
      "The 6th-generation Waymo Driver features a new sensor suite (lidars, cameras, radars) and onboard compute. It powers the Jaguar I-PACE fleet currently in commercial service. Waymo has stated that Gen 6 hardware costs are substantially lower than prior generations, though it has not disclosed specific figures.",
    seeAlso: ["autonomous_miles", "odd"],
  },
  other_bets: {
    term: "Other Bets (Alphabet Segment)",
    shortDefinition:
      "Alphabet's reporting segment that consolidates non-Google businesses, including Waymo.",
    longDefinition:
      "Other Bets reports consolidated revenue and operating loss each quarter. Waymo is the largest constituent but is not broken out separately. Analysts and researchers estimate Waymo's individual financials by subtracting known contributions from other Other Bets businesses. This site does exactly that.",
    seeAlso: ["contribution_margin"],
  },
  capex_intensity: {
    term: "Capex Intensity",
    shortDefinition:
      "Capital expenditure as a proportion of revenue, or per unit of incremental capacity added.",
    longDefinition:
      "For a robotaxi fleet, capex intensity is often measured as capex per incremental weekly ride: how much capital is required to add one more weekly ride to the network. Declining capex intensity over time is a sign that the platform is scaling efficiently.",
    seeAlso: ["unit_economics", "contribution_margin"],
  },
  unit_economics: {
    term: "Unit Economics",
    shortDefinition:
      "The per-ride or per-vehicle revenue and cost structure of the robotaxi business.",
    longDefinition:
      "Unit economics answers the question: does each additional ride make money? The key inputs are revenue per ride (fare), variable cost per ride (energy, remote assist, maintenance), and fixed cost per ride (vehicle and sensor amortization, insurance). Contribution margin turns positive when revenue exceeds variable costs. Full profitability requires covering fixed costs too.",
    seeAlso: ["contribution_margin", "capex_intensity", "remote_assist"],
  },
  cohort: {
    term: "Launch Cohort",
    shortDefinition:
      "A group of cities that launched within the same time period, used to compare how ride volume ramps across markets.",
    longDefinition:
      "Grouping cities by launch cohort normalizes for the age of each market, making it possible to compare Phoenix (launched 2020) with Los Angeles (launched 2024) on the same time axis. Each cohort is colored consistently across charts and the coverage map.",
    seeAlso: ["service_area", "rides_per_vehicle_per_day"],
  },
  rides_per_vehicle_per_day: {
    term: "Rides Per Vehicle Per Day",
    shortDefinition:
      "A utilization metric: total daily rides divided by active fleet size. The cleanest single read on operational efficiency.",
    longDefinition:
      "Higher rides per vehicle per day means each vehicle is earning more revenue and amortizing its fixed costs faster. The metric compresses fleet size and ride volume into one number, making it easier to compare markets of different scales and to track efficiency gains over time.",
    seeAlso: ["unit_economics", "vehicles_in_fleet", "weekly_rides"],
  },
  waitlist_city: {
    term: "Waitlist City",
    shortDefinition:
      "A market where Waymo has announced service but is not yet operating publicly, typically with a signup form for early access.",
    longDefinition:
      "Waitlist cities are counted separately from public cities in operational metrics. A city transitions from waitlist to public when rides become available to any user without prior registration.",
    seeAlso: ["service_area", "cohort"],
  },
  cpuc: {
    term: "CPUC (California Public Utilities Commission)",
    shortDefinition:
      "The California regulator that oversees commercial autonomous vehicle deployments and requires quarterly data disclosure from permitted operators.",
    longDefinition:
      "The CPUC's Autonomous Vehicle Program requires commercial operators like Waymo to file quarterly reports covering trip volumes, incidents, coverage, and fleet data. These filings are the most granular publicly available data on Waymo's California operations. Fleet counts and drivered-vehicle data are subject to confidentiality claims and are partially redacted in public releases.",
    seeAlso: ["autonomous_miles", "rider_only_miles"],
  },
  weekly_rides: {
    term: "Weekly Rides",
    shortDefinition:
      "The estimated number of paid passenger trips completed by Waymo in a given week, across all active markets.",
    longDefinition:
      "Weekly rides is the primary volume metric for Waymo's commercial operations. It is derived from periodic disclosures, analyst estimates, and cross-referenced data sources. Because Waymo does not report weekly figures directly, all estimates carry uncertainty; confidence levels are noted where displayed.",
    seeAlso: ["rider_only_miles", "unit_economics"],
  },
  vehicles_in_fleet: {
    term: "Vehicles in Fleet",
    shortDefinition:
      "The number of autonomous vehicles Waymo has deployed or has available for commercial service.",
    longDefinition:
      "Fleet size is a leading indicator of future ride capacity. Waymo has not disclosed precise fleet counts; estimates are derived from permit filings, city-level disclosures, and reported expansion plans. Active vehicle count (vehicles actually completing rides) is a subset of total fleet and is tracked separately where data is available.",
    seeAlso: ["capex_intensity", "unit_economics"],
  },
  supervision_level: {
    term: "Supervision Level",
    shortDefinition:
      "Whether a robotaxi runs with no one in the driver's seat (driverless), with a safety operator who can intervene, or with a human who is legally the driver.",
    longDefinition:
      "The single most important distinction in comparing operators. Driverless service carries no in-vehicle labor and is what regulators permit last. A safety operator (or safety monitor) can take control; the vehicle is autonomous but not yet trusted alone. In some cases, such as Tesla's Bay Area service under a charter-party permit, the person in the seat is the legal driver and the service is not classified as autonomous at all.",
    seeAlso: ["safety_driver", "disclosure_quality", "tcp_permit"],
  },
  disclosure_quality: {
    term: "Disclosure Quality",
    shortDefinition:
      "How a figure reached the public: a regulatory filing, a company statement, an earnings disclosure, press reporting, or an estimate.",
    longDefinition:
      "Not all numbers are the same kind of fact. Regulatory filings (CPUC quarterly data) are audited by the threat of penalty; earnings disclosures carry securities-law weight; company blog posts are marketing; press-reported figures may be derived by analysts; estimates are exactly that. The landscape table labels every figure so readers can weigh it. The site does not place a marketing claim next to a regulatory filing without saying so.",
    seeAlso: ["cpuc", "supervision_level"],
  },
  tcp_permit: {
    term: "TCP Permit",
    shortDefinition:
      "A California charter-party carrier permit: the same authorization limousine and chauffeur companies hold. It covers human-driven passenger transport, not autonomous vehicles.",
    longDefinition:
      "Tesla operates its Bay Area robotaxi service under a TCP permit obtained in March 2025. The CPUC stated in March 2026 that Tesla is not operating an autonomous vehicle service under this permit and that the person in the car is the driver. As a result Tesla files no per-trip or vehicle-mile data with the state, unlike Waymo, Zoox, and Nuro, which hold AV-specific permits and report quarterly.",
    seeAlso: ["cpuc", "supervision_level"],
  },
  nhtsa_exemption: {
    term: "NHTSA Exemption",
    shortDefinition:
      "Federal permission to sell or operate a vehicle that does not meet standard safety rules written for human-driven cars, such as requirements for a steering wheel or mirrors.",
    longDefinition:
      "Purpose-built robotaxis without manual controls cannot comply with several Federal Motor Vehicle Safety Standards. Zoox received a temporary exemption in July 2026 covering eight standards, capped at 2,500 vehicles per year for two years, which cleared the way for paid rides in its bidirectional vehicle. Tesla's Cybercab will need equivalent relief before it can carry the public.",
    seeAlso: ["supervision_level"],
  },
  standing_general_order: {
    term: "Standing General Order",
    shortDefinition:
      "NHTSA's requirement that companies operating automated driving systems report crashes to the federal government within set timeframes.",
    longDefinition:
      "Issued in 2021 and amended since, the Standing General Order creates the only national, cross-operator crash dataset for automated vehicles. It covers Waymo, Zoox, Tesla, and others, and is the basis for comparative safety analysis in a later phase of this site. Reporting thresholds and redactions limit what can be concluded from it.",
    seeAlso: ["disclosure_quality"],
  },
  form_10k: {
    term: "10-K (Annual Report)",
    shortDefinition:
      "A company's audited annual report to the SEC. The most complete and legally exposed description of a business it publishes each year.",
    longDefinition:
      "Alphabet's 10-K carries the segment tables that put a revenue and operating-loss figure on Other Bets, and the risk factors where autonomous driving is described in the company's own careful language. It is filed a few days after the fourth-quarter earnings release and covers the full fiscal year, which is why this site labels it FY rather than Q4.",
    seeAlso: ["other_bets", "form_8k"],
  },
  form_10q: {
    term: "10-Q (Quarterly Report)",
    shortDefinition:
      "A company's unaudited quarterly report to the SEC, filed for the first three quarters of each fiscal year.",
    longDefinition:
      "Shorter and less examined than the 10-K, but filed under the same liability. Waymo appears in it rarely and briefly, usually inside the Other Bets segment discussion rather than by name.",
    seeAlso: ["form_10k", "other_bets"],
  },
  form_8k: {
    term: "8-K (Earnings Release)",
    shortDefinition:
      "A filing announcing a material event. The subset this site tracks is Item 2.02, the quarterly earnings release.",
    longDefinition:
      "Alphabet files many 8-Ks for governance matters; only those including Item 2.02 (Results of Operations) are earnings releases, and only those are ingested here. The numbers live in the EX-99.1 press-release exhibit attached to the filing rather than in the filing's own body, so both are stored.",
    seeAlso: ["form_10k", "other_bets"],
  },
  fiscal_period: {
    term: "Fiscal Period",
    shortDefinition:
      "The quarter or year a document reports on, which is not the date it was filed.",
    longDefinition:
      "Alphabet's fiscal year is the calendar year. A quarterly report is labeled by the quarter it covers; an earnings release is labeled by the completed quarter it reports, not the month it is issued; an annual report is labeled FY because it reports the full year alongside the fourth quarter. On this site the label is derived from the filing's own report date, never entered by hand.",
    seeAlso: ["form_10k", "form_8k"],
  },
  verbatim_verification: {
    term: "Verbatim Verification",
    shortDefinition:
      "Matching every quote character by character against the stored source document before it is saved, and discarding anything that does not appear there.",
    longDefinition:
      "A language model asked to quote a document will sometimes return a fluent sentence that the document does not contain. Rather than trusting or correcting such output, this site checks each returned quote against the exact passage it cites, normalizing only curly quotes and dash characters, and discards any quote that fails, logging it with the reason. A quote that cannot be found verbatim is by definition not a quote. Verification happens before human review, so a reviewer never sees invented text.",
    seeAlso: ["disclosure_quality"],
  },
};

export type GlossaryKey = keyof typeof glossary;
