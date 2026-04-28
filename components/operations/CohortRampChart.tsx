import { Term } from "@/components/ui/Term";

// Pending state: renders until per-city ride volume data arrives in 1.3.
// TODO: user to replace with final copy

export function CohortRampChart() {
  return (
    <section aria-label="Cohort ramp chart" className="py-16 sm:py-20">
      {/* TODO: user to replace with final copy */}
      <p className="font-serif text-[2.25rem] sm:text-[3rem] leading-tight font-normal text-foreground max-w-2xl">
        Per-city ride volume data lands when the scraper backfills in 1.3.
        This chart will plot weeks since launch on the x-axis and rides per
        week on the y-axis, with one line per city colored by{" "}
        <Term term="cohort">launch cohort</Term>.
      </p>
    </section>
  );
}
