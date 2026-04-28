import { Term } from "@/components/ui/Term";

// Pending state: renders until fleet snapshots and ride estimates arrive in 1.3.
// TODO: user to replace with final copy

export function RidesPerVehicleChart() {
  return (
    <section aria-label="Rides per vehicle per day chart" className="py-16 sm:py-20">
      {/* TODO: user to replace with final copy */}
      <p className="font-serif text-[2.25rem] sm:text-[3rem] leading-tight font-normal text-foreground max-w-2xl">
        Per-vehicle utilization figures depend on fleet snapshots paired with
        ride estimates, both arriving with the scrapers in 1.3. The chart will
        plot{" "}
        <Term term="rides_per_vehicle_per_day">rides per vehicle per day</Term>{" "}
        across the operating cities over time, with the network average
        overlaid as a heavier line.
      </p>
    </section>
  );
}
