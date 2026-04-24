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
};

export type GlossaryKey = keyof typeof glossary;
