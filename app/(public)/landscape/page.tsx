import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { MarkdownBody } from "@/components/ui/MarkdownBody";
import { Term } from "@/components/ui/Term";
import { getSiteContent } from "@/lib/site-content";
import {
  getLandscapePrograms,
  getLandscapeCities,
  getWaymoCitiesForMap,
  getCpucComparison,
} from "@/lib/landscape";
import { OperatorTable } from "@/components/landscape/OperatorTable";
import { SupervisionStrip } from "@/components/landscape/SupervisionStrip";
import { OperatorMapClient } from "@/components/landscape/OperatorMapClient";
import { CpucComparisonChart } from "@/components/landscape/CpucComparisonChart";

export const revalidate = 3600;

export const metadata = {
  title: "The Landscape | The Empty Seat",
  description:
    "Who is actually operating robotaxis, at what scale, with what disclosure quality: Waymo, Zoox, Tesla, Nuro and Lucid with Uber, Baidu Apollo Go, Pony.ai, WeRide, and the rest.",
};

// TODO: user to replace with final copy (edit via /admin/site-content/landscape_intro)
const INTRO_FALLBACK = `The robotaxi field is no longer a one-company story, but it is still a lopsided one. Waymo carries roughly half a million paid riders a week across eleven US metros. Everyone else in the United States is either just charging its first fares, running with a safety operator, or not yet open to the public at all. In China, Baidu's Apollo Go runs a comparable weekly volume at a fraction of the vehicle cost, and three Chinese operators are exporting driverless service to the Gulf and Europe faster than any American operator.

This page tracks each program at the fidelity its own disclosures allow. Where a company files with a regulator, the number is labeled as such. Where the only figure available is an analyst's reading of a company chart, that is labeled too. Blank cells are deliberate: an operator that has not disclosed a fleet size has told you something.`;

const CHINA_FALLBACK = `The Chinese operators run a different game. Baidu's Apollo Go reported 3.2 million fully driverless rides in the first quarter of 2026, a weekly peak above 350,000, on a purpose-built RT6 that Baidu says costs about $28,000 to build. Pony.ai claims per-vehicle unit-economics breakeven in Guangzhou on its seventh-generation kit and puts its vehicle cost at a quarter to a fifth of Waymo's. WeRide says its Abu Dhabi operation turned operationally profitable after removing safety officers.

Two caveats travel with those numbers. Chinese fares are lower, so ride counts do not translate to comparable revenue. And the industry hit a wall this spring: a mass outage that froze roughly a hundred Apollo Go vehicles on Wuhan streets in March triggered a nationwide freeze on new permits from April to late July, and Wuhan resumed with safety drivers back in the cars.

The more consequential development for US observers is the export. Apollo Go and WeRide run driverless commercial service in Dubai and Abu Dhabi on the Uber app; Pony.ai operates in Zagreb, Doha, Singapore, and Seoul and has committed 2,000 vehicles across five European cities with Uber. Uber is the common rail for nearly every non-Waymo operator on earth, which is a fact about Uber as much as about any of them.`;

// TODO: user to replace with final copy (edit via /admin/site-content/landscape_regulatory)
const REGULATORY_FALLBACK = `The most honest comparison available in the United States comes from the California Public Utilities Commission, which requires every permitted operator to file the same quarterly data template. Waymo files in the Deployment tier (paid public service). Zoox files in the Pilot tier (passengers allowed, fares not), and Nuro joins the Pilot tier from the second quarter of 2026. Same regulator, same columns, same cadence.

The gap is enormous and the chart does not hide it: Waymo completed roughly 3.9 million California trips in the first quarter of 2026; Zoox completed about 23,000. But the shape of Zoox's line matters more than its level. Its monthly driverless trips doubled across the quarter, from 5,219 in January to 10,685 in March, before it had charged a single fare. When Nuro's first filing lands, the same chart will show whether the Uber program is following that curve.`;

const METHOD_FALLBACK = `Every figure on this page is a point-in-time reading with a stated disclosure quality: a regulatory filing, an earnings disclosure, a company statement, press reporting, or an estimate. Blank cells mean the operator has not disclosed the figure. Third-party figures are never used for headline claims. Sources are linked from each disclosure badge and cataloged on the sources page. Snapshots are updated as new disclosures land; the as-of date on each row is the date of the underlying disclosure, not the date it was entered here.`;

export default async function LandscapePage() {
  const [programs, competitorCities, waymoCities, cpuc, intro, china, method, regulatoryCopy] =
    await Promise.all([
      getLandscapePrograms(),
      getLandscapeCities(),
      getWaymoCitiesForMap(),
      getCpucComparison(),
      getSiteContent("landscape_intro"),
      getSiteContent("landscape_china"),
      getSiteContent("landscape_methodology"),
      getSiteContent("landscape_regulatory"),
    ]);
  const hasPilotSeries = cpuc.some((s) => s.tier === "pilot");

  const allCities = [...waymoCities, ...competitorCities];
  const usCities = allCities.filter((c) => c.country === "US");

  return (
    <>
      <section className="border-b border-border">
        <Container className="py-24 sm:py-32 max-w-3xl">
          <Heading level={1}>The landscape</Heading>
          <p className="mt-3 text-muted text-base">
            Who is actually operating robotaxis, at what scale, and how well we know it.
          </p>
          <div className="mt-10">
            <MarkdownBody content={intro?.markdown_body ?? INTRO_FALLBACK} />
          </div>
        </Container>
      </section>

      <section id="operators" className="border-b border-border scroll-mt-20">
        <Container className="py-20 sm:py-24">
          <Heading level={2}>The operators</Heading>
          <p className="mt-3 mb-10 text-muted text-base max-w-2xl">
            One row per program on the road. Cities counts public riders (with total operating
            markets after the slash where they differ). Hover a disclosure badge for the reading&apos;s
            provenance and source.
          </p>
          <OperatorTable programs={programs} />
        </Container>
      </section>

      <section id="supervision" className="border-b border-border bg-surface scroll-mt-20">
        <Container className="py-20 sm:py-24">
          <Heading level={2}>Who is in the driver&apos;s seat</Heading>
          <div className="mt-8">
            <SupervisionStrip programs={programs} />
          </div>
        </Container>
      </section>

      <section id="regulatory" className="border-b border-border scroll-mt-20">
        <Container className="py-20 sm:py-24">
          <Heading level={2}>The same regulator, side by side</Heading>
          <div className="mt-8 max-w-3xl">
            <MarkdownBody content={regulatoryCopy?.markdown_body ?? REGULATORY_FALLBACK} />
          </div>
          {hasPilotSeries ? (
            <div className="mt-10">
              <CpucComparisonChart series={cpuc} />
            </div>
          ) : (
            <p className="mt-10 font-serif text-[1.75rem] sm:text-[2.25rem] leading-tight font-normal text-foreground max-w-2xl">
              Pilot-tier CPUC data for Zoox (and Nuro from Q2 2026) charts here once the
              scraper has ingested the pilot filings.
            </p>
          )}
          <aside className="mt-12 max-w-3xl border-l-2 border-accent pl-5">
            <p className="font-serif text-lg text-foreground">Why Tesla is not on this chart</p>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Tesla runs its Bay Area service under a{" "}
              <Term term="tcp_permit">charter-party (TCP) permit</Term>, the authorization
              limousine companies hold, not a California autonomous vehicle permit. In March 2026
              the CPUC stated that Tesla is not operating an autonomous vehicle service and that the
              person in the car is the driver. Tesla therefore files no per-trip, mileage, or
              incident data with the state. Its Texas and Florida operations are unsupervised, but
              those states publish no equivalent series. What exists for Tesla is its own earnings
              charts, from which analysts derived the ~21-vehicle unsupervised fleet figure shown in
              the table above. That is a different kind of fact from a regulatory filing, and this
              site does not put the two on one axis.
            </p>
          </aside>
        </Container>
      </section>

      <section id="map" className="border-b border-border scroll-mt-20">
        <Container className="py-20 sm:py-24">
          <Heading level={2}>Where they operate</Heading>
          <p className="mt-3 mb-8 text-muted text-base max-w-2xl">
            United States deployments by operator. Solid markers are public service; ringed
            markers are employee-only or waitlisted; hollow markers are announced. Service areas are
            not drawn because most operators do not disclose them.
          </p>
          <OperatorMapClient cities={usCities} region="us" />
        </Container>
      </section>

      <section id="international" className="border-b border-border scroll-mt-20">
        <Container className="py-20 sm:py-24">
          <Heading level={2}>China and the export</Heading>
          <div className="mt-8 max-w-3xl">
            <MarkdownBody content={china?.markdown_body ?? CHINA_FALLBACK} />
          </div>
          <div className="mt-12">
            <OperatorMapClient cities={allCities} region="world" />
          </div>
        </Container>
      </section>

      <section id="method" className="scroll-mt-20">
        <Container className="py-16 sm:py-20 max-w-3xl">
          <h2 className="font-serif text-xl text-foreground">How to read this page</h2>
          <div className="mt-4 text-sm text-muted leading-relaxed">
            <MarkdownBody content={method?.markdown_body ?? METHOD_FALLBACK} className="[&_p]:text-sm [&_p]:text-muted" />
          </div>
          <p className="mt-6 text-xs text-muted">
            Terms: <Term term="supervision_level">supervision level</Term>,{" "}
            <Term term="disclosure_quality">disclosure quality</Term>,{" "}
            <Term term="tcp_permit">TCP permit</Term>,{" "}
            <Term term="nhtsa_exemption">NHTSA exemption</Term>,{" "}
            <Term term="cpuc">CPUC</Term>. Full source list on the{" "}
            <a href="/methodology/sources" className="underline hover:text-foreground transition-colors">
              sources page
            </a>
            .
          </p>
        </Container>
      </section>
    </>
  );
}
