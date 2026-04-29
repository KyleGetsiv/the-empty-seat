import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { CityLaunchTimeline } from "@/components/operations/CityLaunchTimeline";
import {
  QuarterlyTripsChart,
  type ChartDataPoint,
} from "@/components/operations/QuarterlyTripsChart";
import { CoverageMapClient } from "@/components/operations/CoverageMapClient";
import type { TimelineCity } from "@/components/operations/CityLaunchTimeline";
import type { MapCity } from "@/components/operations/CoverageMapClient";

async function getWaymoCities() {
  const supabase = await createSupabaseServerClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();

  if (!company) return { cities: [], waymoId: null };

  const { data: cities } = await supabase
    .from("cities")
    .select(
      "id, name, metro_area, launch_date, public_access_date, service_area_sq_mi, status, latitude, longitude"
    )
    .eq("company_id", (company as { id: string }).id)
    .not("launch_date", "is", null)
    .order("launch_date", { ascending: true });

  return { cities: cities ?? [], waymoId: (company as { id: string }).id };
}

async function getCpucChartData(waymoId: string): Promise<ChartDataPoint[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("ride_estimates")
    .select("period_start, rides_per_week")
    .eq("company_id", waymoId)
    .is("city_id", null)
    .order("period_start", { ascending: true });

  if (!data || data.length === 0) return [];

  const rows = data as { period_start: string; rides_per_week: number }[];

  return rows.map((row, i) => {
    const d = new Date(row.period_start + "T00:00:00Z");
    const year = d.getUTCFullYear();
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    const trips = (row.rides_per_week ?? 0) * 13;
    const prevTrips = i > 0 ? (rows[i - 1].rides_per_week ?? 0) * 13 : null;
    const qoqGrowth =
      prevTrips && prevTrips > 0 ? ((trips - prevTrips) / prevTrips) * 100 : null;
    return { label: `Q${q} ${year}`, trips, qoqGrowth };
  });
}

export async function Operations() {
  const { cities, waymoId } = await getWaymoCities();

  const cpucChartData: ChartDataPoint[] = waymoId
    ? await getCpucChartData(waymoId)
    : [];

  const timelineCities: TimelineCity[] = cities
    .filter((c) => c.launch_date !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      metro_area: c.metro_area,
      launch_date: c.launch_date as string,
      public_access_date: c.public_access_date,
      service_area_sq_mi: c.service_area_sq_mi ? Number(c.service_area_sq_mi) : null,
      status: c.status,
      latitude: c.latitude ? Number(c.latitude) : null,
      longitude: c.longitude ? Number(c.longitude) : null,
    }));

  const mapCities: MapCity[] = cities
    .filter((c) => c.launch_date !== null && c.latitude !== null && c.longitude !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      launch_date: c.launch_date as string,
      service_area_sq_mi: c.service_area_sq_mi ? Number(c.service_area_sq_mi) : null,
      status: c.status,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
    }));

  return (
    <section
      id="operations"
      className="border-b border-border scroll-mt-20"
    >
      <Container className="py-24 sm:py-32">
        <Heading level={2}>Operations</Heading>

        {/* TODO: user to replace with section intro copy */}
        <p className="mt-3 text-muted text-base max-w-2xl">
          A live look at where Waymo operates, how each market launched, and the quarterly
          volume trajectory sourced from California Public Utilities Commission filings.
        </p>

        <CityLaunchTimeline cities={timelineCities} />

        {/* TODO: user to replace with timeline-to-chart transition copy */}
        <p className="mt-16 mb-10 text-muted text-base max-w-2xl">
          The timeline above shows when each city came online. The chart below tracks
          California trip volume quarter by quarter from CPUC regulatory disclosures,
          the most granular public view of Waymo&apos;s ride trajectory.
        </p>

        <QuarterlyTripsChart data={cpucChartData} />

        {/* TODO: user to replace with chart-to-map transition copy */}
        <p className="mt-16 mb-10 text-muted text-base max-w-2xl">
          Each market occupies a distinct footprint. The map below shows service areas
          at their current scale.
        </p>

        <CoverageMapClient cities={mapCities} />

        <p className="mt-16 text-xs text-muted max-w-2xl leading-relaxed">
          Quarterly figures sourced from California Public Utilities Commission filings.
          See our{" "}
          <a
            href="/methodology"
            className="underline hover:text-foreground transition-colors"
          >
            methodology page
          </a>
          {" "}for full source attribution, data limitations, and a pointer to live
          community-tracked data.
        </p>
      </Container>
    </section>
  );
}
