import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { getDisclosedSeries } from "@/lib/disclosed-metrics";
import {
  DisclosedRidesChart,
  type DisclosedChartPoint,
} from "@/components/charts/DisclosedRidesChart";

const TARGET_SOURCE_URL = "https://waymo.com/blog/2025/12/2025-year-in-review/";

function monthYear(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function NationalTrajectory() {
  const series = await getDisclosedSeries("weekly_rides");

  const points: DisclosedChartPoint[] = series.map((p) => ({
    t: new Date(p.as_of + "T00:00:00Z").getTime(),
    dateLabel: monthYear(p.as_of),
    company: p.attribution === "company" ? p.value : null,
    thirdParty: p.attribution !== "company" ? p.value : null,
    statedBy: p.stated_by,
    attribution: p.attribution,
    sourceUrl: p.source?.url ?? null,
    sourcePublisher: p.source?.publisher ?? null,
  }));

  const latestCompany = [...series]
    .reverse()
    .find((p) => p.attribution === "company");

  return (
    <section id="trajectory" className="border-b border-border scroll-mt-20">
      <Container className="py-24 sm:py-32">
        <Heading level={2}>The trajectory</Heading>

        {points.length === 0 ? (
          <p className="mt-10 font-serif text-[2.25rem] sm:text-[3rem] leading-tight font-normal text-foreground max-w-2xl">
            Waymo&apos;s disclosed weekly ride counts chart here once the
            disclosure series is seeded.
          </p>
        ) : (
          <>
            {/* TODO: user to replace with final copy */}
            <p className="mt-3 mb-10 text-muted text-base max-w-2xl">
              Waymo discloses its worldwide weekly ride count episodically: a
              blog post here, an earnings call there. Charted together, those
              disclosures are the most honest public view of the company&apos;s
              national trajectory, including the stretches where the number
              stopped moving.
            </p>

            <DisclosedRidesChart points={points} />

            <p className="mt-6 text-xs text-muted max-w-2xl leading-relaxed">
              Each dot is a public disclosure; click it to open the source, or
              browse the{" "}
              <a
                href="/methodology/sources"
                className="underline hover:text-foreground transition-colors"
              >
                sources page
              </a>
              . Third-party figures were not confirmed by Waymo. The 1M target
              was stated in Waymo&apos;s{" "}
              <a
                href={TARGET_SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                2025 year-in-review
              </a>
              {latestCompany && (
                <>
                  . Latest company figure:{" "}
                  {latestCompany.value.toLocaleString("en-US")} weekly rides, as
                  of {monthYear(latestCompany.as_of)}
                </>
              )}
              .
            </p>
          </>
        )}
      </Container>
    </section>
  );
}
