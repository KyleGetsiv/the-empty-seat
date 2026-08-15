import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestDisclosedWeeklyRides } from "@/lib/disclosed-metrics";
import { Container } from "@/components/ui/Container";
import { Metric } from "@/components/ui/Metric";

const CPUC_SOURCE_URL =
  "https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting";

type CpucStats = {
  latestRidesPerWeek: number | null;
  latestPeriodLabel: string | null;
  // Sums are scoped to the most recent calendar year with all four CPUC
  // quarters present; statsYear names that year for labels and tooltips.
  statsYear: number | null;
  yearTrips: number;
  yearMiles: number;
  hasData: boolean;
};

function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtMillions(n: number): string {
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatDisclosedDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function getCitiesServed(waymoId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("cities")
    .select("id", { count: "exact", head: true })
    .eq("company_id", waymoId)
    .in("status", ["public", "waitlist"]);
  return count ?? 0;
}

async function getCpucStats(waymoId: string): Promise<CpucStats> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("ride_estimates")
    .select("rides_per_week, vehicle_miles_traveled, period_end, period_start")
    .eq("company_id", waymoId)
    .is("city_id", null)
    .order("period_end", { ascending: false });

  // Defensive: only quarter-length rows (roughly 90-day periods) belong to
  // the CPUC series. Shorter rows (e.g. a mis-entered disclosure week) must
  // not pollute the sums or the latest-quarter readout.
  const quarterRows = (data ?? []).filter((row) => {
    const r = row as { period_start: string; period_end: string };
    const span =
      (new Date(r.period_end + "T00:00:00Z").getTime() -
        new Date(r.period_start + "T00:00:00Z").getTime()) /
      86_400_000;
    return span >= 80;
  });

  if (quarterRows.length === 0) {
    return {
      latestRidesPerWeek: null,
      latestPeriodLabel: null,
      statsYear: null,
      yearTrips: 0,
      yearMiles: 0,
      hasData: false,
    };
  }

  const latest = quarterRows[0] as {
    rides_per_week: number;
    vehicle_miles_traveled: number | null;
    period_end: string;
    period_start: string;
  };

  const latestPeriodLabel = periodToQuarterLabel(latest.period_start);

  // Group by calendar year; use the most recent year with 4 quarters.
  const byYear = new Map<number, { count: number; trips: number; miles: number }>();
  for (const row of quarterRows) {
    const r = row as {
      rides_per_week: number;
      vehicle_miles_traveled: number | null;
      period_start: string;
    };
    const year = new Date(r.period_start + "T00:00:00Z").getUTCFullYear();
    const agg = byYear.get(year) ?? { count: 0, trips: 0, miles: 0 };
    agg.count++;
    agg.trips += (r.rides_per_week ?? 0) * 13;
    agg.miles += Number(r.vehicle_miles_traveled ?? 0);
    byYear.set(year, agg);
  }
  const complete = [...byYear.entries()]
    .filter(([, v]) => v.count === 4)
    .sort((a, b) => b[0] - a[0]);
  const statsYear = complete.length > 0 ? complete[0][0] : null;
  const yearAgg = statsYear !== null ? complete[0][1] : null;

  return {
    latestRidesPerWeek: latest.rides_per_week,
    latestPeriodLabel,
    statsYear,
    yearTrips: yearAgg?.trips ?? 0,
    yearMiles: yearAgg?.miles ?? 0,
    hasData: true,
  };
}

function periodToQuarterLabel(periodStart: string): string {
  const d = new Date(periodStart + "T00:00:00Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const q = Math.floor(month / 3) + 1;
  return `Q${q} ${year}`;
}

export async function KeyStats() {
  const supabase = await createSupabaseServerClient();
  const { data: waymo } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();

  if (!waymo) return null;

  const waymoId = (waymo as { id: string }).id;

  const [citiesServed, cpuc, disclosed] = await Promise.all([
    getCitiesServed(waymoId),
    getCpucStats(waymoId),
    getLatestDisclosedWeeklyRides(),
  ]);

  return (
    <section className="border-b border-border bg-surface">
      <Container className="py-16 sm:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12">

          {/* Tile 1: Weekly rides (disclosed worldwide, or CPUC CA fallback) */}
          <div className="flex flex-col gap-2">
            {disclosed ? (
              <Metric
                value={fmtCount(disclosed.value)}
                explanation={<>From Waymo&apos;s most recent company-wide disclosure.</>}
                sourceUrl={disclosed.source.url}
                asOf={formatDisclosedDate(disclosed.as_of)}
                className="text-[3.25rem] leading-none tabular-nums"
              />
            ) : cpuc.hasData && cpuc.latestRidesPerWeek !== null ? (
              <Metric
                value={fmtCount(cpuc.latestRidesPerWeek)}
                explanation={
                  <>
                    Weekly average over the most recent quarter, derived from CPUC quarterly
                    filings. California operations only. Latest data: {cpuc.latestPeriodLabel}.
                  </>
                }
                sourceUrl={CPUC_SOURCE_URL}
                asOf={cpuc.latestPeriodLabel ?? undefined}
                className="text-[3.25rem] leading-none tabular-nums"
              />
            ) : (
              <span className="font-serif text-[3.25rem] leading-none font-normal text-muted tabular-nums">
                --
              </span>
            )}
            <p className="text-sm font-medium text-foreground tracking-wide uppercase">
              {disclosed ? "Weekly rides" : "Avg weekly rides (CA)"}
            </p>
          </div>

          {/* Tile 2: Cities served */}
          <div className="flex flex-col gap-2 md:pl-12">
            <Metric
              value={citiesServed}
              explanation={
                <>
                  Count of Waymo cities serving public riders (status &ldquo;public&rdquo; or
                  &ldquo;waitlist&rdquo;). Excludes markets in employee-only driverless operation
                  and announced markets. See the city launch timeline below for detail.
                </>
              }
              className="text-[3.25rem] leading-none tabular-nums"
            />
            <p className="text-sm font-medium text-foreground tracking-wide uppercase">
              Cities served
            </p>
          </div>

          {/* Tile 3: Cumulative trips, latest complete year (CA) */}
          <div className="flex flex-col gap-2">
            {cpuc.hasData && cpuc.statsYear !== null && cpuc.yearTrips > 0 ? (
              <Metric
                value={fmtMillions(cpuc.yearTrips)}
                explanation={
                  <>
                    Total fulfilled trips in California during {cpuc.statsYear}, derived from
                    CPUC quarterly filings (four quarters summed). California operations only.
                  </>
                }
                sourceUrl={CPUC_SOURCE_URL}
                asOf={`Full year ${cpuc.statsYear}`}
                className="text-[3.25rem] leading-none tabular-nums"
              />
            ) : (
              <span className="font-serif text-[3.25rem] leading-none font-normal text-muted tabular-nums">
                --
              </span>
            )}
            <p className="text-sm font-medium text-foreground tracking-wide uppercase">
              Trips in {cpuc.statsYear ?? "--"} (CA)
            </p>
          </div>

          {/* Tile 4: Vehicle miles, latest complete year (CA) */}
          <div className="flex flex-col gap-2">
            {cpuc.hasData && cpuc.statsYear !== null && cpuc.yearMiles > 0 ? (
              <Metric
                value={fmtMillions(cpuc.yearMiles)}
                explanation={
                  <>
                    Vehicle miles traveled in California during {cpuc.statsYear}, sourced from
                    CPUC quarterly filings (four quarters summed). Zero-emission vehicles only
                    (Waymo&apos;s full fleet). California operations only.
                  </>
                }
                sourceUrl={CPUC_SOURCE_URL}
                asOf={`Full year ${cpuc.statsYear}`}
                className="text-[3.25rem] leading-none tabular-nums"
              />
            ) : (
              <span className="font-serif text-[3.25rem] leading-none font-normal text-muted tabular-nums">
                --
              </span>
            )}
            <p className="text-sm font-medium text-foreground tracking-wide uppercase">
              Miles driven {cpuc.statsYear ?? "--"} (CA)
            </p>
          </div>

        </div>

        {!cpuc.hasData && !disclosed && (
          <p className="mt-10 text-sm text-muted max-w-sm leading-relaxed">
            California CPUC quarterly data populates tiles 1, 3, and 4 once the scraper has run.
          </p>
        )}
      </Container>
    </section>
  );
}
