import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { CityLaunchTimeline } from "@/components/operations/CityLaunchTimeline";
import { CohortRampChart } from "@/components/operations/CohortRampChart";
import { CoverageMapClient } from "@/components/operations/CoverageMapClient";
import { RidesPerVehicleChart } from "@/components/operations/RidesPerVehicleChart";
import type { TimelineCity } from "@/components/operations/CityLaunchTimeline";
import type { MapCity } from "@/components/operations/CoverageMapClient";

async function getWaymoCities() {
  const supabase = await createSupabaseServerClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();

  if (!company) return [];

  const { data: cities } = await supabase
    .from("cities")
    .select(
      "id, name, metro_area, launch_date, public_access_date, service_area_sq_mi, status, latitude, longitude"
    )
    .eq("company_id", company.id)
    .not("launch_date", "is", null)
    .order("launch_date", { ascending: true });

  return cities ?? [];
}

export async function Operations() {
  const cities = await getWaymoCities();

  const timelineCities: TimelineCity[] = cities
    .filter((c): c is typeof c & { launch_date: string } => c.launch_date !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      metro_area: c.metro_area,
      launch_date: c.launch_date,
      public_access_date: c.public_access_date,
      service_area_sq_mi: c.service_area_sq_mi ? Number(c.service_area_sq_mi) : null,
      status: c.status,
      latitude: c.latitude ? Number(c.latitude) : null,
      longitude: c.longitude ? Number(c.longitude) : null,
    }));

  const mapCities: MapCity[] = cities
    .filter(
      (c): c is typeof c & { launch_date: string; latitude: number; longitude: number } =>
        c.launch_date !== null && c.latitude !== null && c.longitude !== null
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      launch_date: c.launch_date,
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
          A live look at where Waymo operates, how each market has ramped since
          launch, and the utilization metrics that matter most for unit economics.
        </p>

        <CityLaunchTimeline cities={timelineCities} />

        {/* TODO: user to replace with timeline-to-cohort transition copy */}
        <p className="mt-16 mb-10 text-muted text-base max-w-2xl">
          The timeline above shows when each city came online. The chart below
          normalizes those launches to a common x-axis so the ramp curves can
          be compared directly.
        </p>

        <CohortRampChart />

        {/* TODO: user to replace with cohort-to-map transition copy */}
        <p className="mt-16 mb-10 text-muted text-base max-w-2xl">
          Each market occupies a distinct footprint. The map below shows service
          areas at their current scale, colored by launch cohort.
        </p>

        <CoverageMapClient cities={mapCities} />

        {/* TODO: user to replace with map-to-utilization transition copy */}
        <p className="mt-16 mb-10 text-muted text-base max-w-2xl">
          Scale and geography tell part of the story. The chart below narrows
          to the metric that matters most for unit economics.
        </p>

        <RidesPerVehicleChart />
      </Container>
    </section>
  );
}
