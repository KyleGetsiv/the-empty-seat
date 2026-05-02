import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestDisclosedWeeklyRides } from "@/lib/disclosed-metrics";
import { Container } from "@/components/ui/Container";
import { Metric } from "@/components/ui/Metric";

const CPUC_SOURCE_URL =
  "https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting";

type CpucStats = {
  latestRidesPerWeek: number | null;
  latestPeriodLabel: string | null;
  cumulativeTrips: number;
  cumulativeMiles: number;
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

  if (!data || data.length === 0) {
    return {
      latestRidesPerWeek: null,
      latestPeriodLabel: null,
      cumulativeTrips: 0,
      cumulativeMiles: 0,
      hasData: false,
    };
  }

  const latest = data[0] as {
    rides_per_week: number;
    vehicle_miles_traveled: number | null;
    period_end: string;
    period_start: string;
  };

  const latestPeriodLabel = periodToQuarterLabel(latest.period_start);

  let cumulativeTrips = 0;
  let cumulativeMiles = 0;
  for (const row of data as typeof data) {
    const r = row as {
      rides_per_week: number;
      vehicle_miles_traveled: number | null;
    };
    cumulativeTrips += (r.rides_per_week ?? 0) * 13;
    cumulativeMiles += Number(r.vehicle_miles_traveled ?? 0);
  }

  return {
    latestRidesPerWeek: latest.rides_per_week,
    latestPeriodLabel,
    cumulativeTrips,
    cumulativeMiles,
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
                    filings. California operations only. Latest data: {cpuc.latestPeriodLabel}{" "}
                    (filed February 2026).
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
                  Count of Waymo cities with status &ldquo;public&rdquo; or &ldquo;waitlist.&rdquo;
                  Includes markets where Waymo has announced service and signup is open, even if
                  full public access is pending. See the city launch timeline below for detail.
                </>
              }
              className="text-[3.25rem] leading-none tabular-nums"
            />
            <p className="text-sm font-medium text-foreground tracking-wide uppercase">
              Cities served
            </p>
          </div>

          {/* Tile 3: Cumulative trips 2025 (CA) */}
          <div className="flex flex-col gap-2">
            {cpuc.hasData && cpuc.cumulativeTrips > 0 ? (
              <Metric
                value={fmtMillions(cpuc.cumulativeTrips)}
                explanation={
                  <>
                    Total fulfilled trips in California during 2025, derived from CPUC quarterly
                    filings (four quarters summed). California operations only.
                  </>
                }
                sourceUrl={CPUC_SOURCE_URL}
                asOf="Full year 2025"
                className="text-[3.25rem] leading-none tabular-nums"
              />
            ) : (
              <span className="font-serif text-[3.25rem] leading-none font-normal text-muted tabular-nums">
                --
              </span>
            )}
            <p className="text-sm font-medium text-foreground tracking-wide uppercase">
              Trips in 2025 (CA)
            </p>
          </div>

          {/* Tile 4: Vehicle miles 2025 (CA) */}
          <div className="flex flex-col gap-2">
            {cpuc.hasData && cpuc.cumulativeMiles > 0 ? (
              <Metric
                value={fmtMillions(cpuc.cumulativeMiles)}
                explanation={
                  <>
                    Vehicle miles traveled in California during 2025, sourced from CPUC quarterly
                    filings (four quarters summed). Zero-emission vehicles only (Waymo&apos;s full
                    fleet). California operations only.
                  </>
                }
                sourceUrl={CPUC_SOURCE_URL}
                asOf="Full year 2025"
                className="text-[3.25rem] leading-none tabular-nums"
              />
            ) : (
              <span className="font-serif text-[3.25rem] leading-none font-normal text-muted tabular-nums">
                --
              </span>
            )}
            <p className="text-sm font-medium text-foreground tracking-wide uppercase">
              Miles driven 2025 (CA)
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
