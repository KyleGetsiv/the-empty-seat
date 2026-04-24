import { PageShell } from "@/components/sections/PageShell";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Prose } from "@/components/ui/Prose";

// TODO: user to replace with final copy
export default function Home() {
  return (
    <PageShell>
      <Container className="py-24 sm:py-32">
        <Heading level={1} className="mb-8 max-w-3xl">
          The autonomous mile is the new unit of progress.
        </Heading>
        <Prose className="max-w-2xl">
          <p>
            The Empty Seat is a research project tracking Waymo: its operations,
            unit economics, and implied financials. Built for investors and
            operators who want primary sources, not press releases.
          </p>
          <p>
            More coming soon. The site is being built in the open, phase by
            phase.
          </p>
        </Prose>
      </Container>
    </PageShell>
  );
}
