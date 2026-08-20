import { Suspense } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { MarkdownBody } from "@/components/ui/MarkdownBody";
import { Term } from "@/components/ui/Term";
import { getSiteContent } from "@/lib/site-content";
import { getEarningsTimeline, summarizeCorpus } from "@/lib/earnings-public";
import { formatEventDate } from "@/lib/earnings-mentions";
import { EarningsTimeline } from "@/components/earnings/EarningsTimeline";
import { TimelineGroups } from "@/components/earnings/TimelineGroups";
import { DisclosurePosture } from "@/components/earnings/DisclosurePosture";

export const revalidate = 3600;

export const metadata = {
  title: "What Alphabet Says About Waymo | The Empty Seat",
  description:
    "Every Alphabet filing and earnings call since 2023, read for what it says about Waymo. Quotes are verified verbatim against the source document and reviewed by hand before publication.",
};

// TODO: user to replace with final copy (edit via /admin/site-content/earnings_intro)
const INTRO_FALLBACK = `Alphabet does not report Waymo. There is no Waymo revenue line, no Waymo segment, no Waymo margin. What exists instead is a scatter of sentences: a number Sundar Pichai gives on a call, a clause in a 10-K risk factor, a figure in an Other Bets table that includes Waymo and six other businesses. Read one at a time they are anecdotes. Read in sequence they are the only first-party record of how fast this is going.

This page is that sequence. Every Alphabet 10-K, 10-Q, earnings release, and earnings call since 2023 is ingested whole, read for passages that mention Waymo or Other Bets, and quoted. Nothing here is paraphrase. Every quote was checked character by character against the source document before it was stored, and checked again by a human before it was published.

Documents where Alphabet said nothing about Waymo are listed too, and say so. That is the part most trackers leave out, and it is the part that makes the rest of the page mean anything.`;

// TODO: user to replace with final copy (edit via /admin/site-content/earnings_methodology)
const METHOD_FALLBACK = `**How a quote gets here.** Filings arrive from the SEC's own submissions API (10-K, 10-Q, and the 8-K earnings releases, which is where the segment tables live). Call transcripts arrive from published sitemaps, never by guessing URLs. Each document is stored whole so extraction can be re-run against the exact bytes that were read.

**What the model does, and what it is not trusted to do.** The document is split into labeled passages, and only passages mentioning Waymo or Other Bets, plus one neighbor for context, are sent to the model. The model's job is to return quotes and point at the passage each came from. It is not trusted to transcribe: every returned quote is matched character by character against the passage it cites, and a quote that does not appear there verbatim is discarded and logged rather than corrected. Speaker names come from the transcript's own turn structure, not from the model.

**What a human does.** Nothing extracted is public until it is approved by hand. Approval is per quote, so one bad item cannot carry a good one with it, and rejection is recorded rather than deleted. Where an approved quote carries a figure, approving it publishes that figure as a disclosed metric, which is how the numbers on the rest of this site acquire a named speaker and a dated primary source.

**What this page cannot tell you.** Alphabet chooses what to say. A quarter of silence is a fact about Alphabet's disclosure, not about Waymo's business, and the two should not be confused. Figures given on a call are not audited segment reporting. Where a quarter's transcript was never published, the document is absent rather than assumed.`;

export default async function EarningsPage() {
  const [events, intro, method] = await Promise.all([
    getEarningsTimeline(),
    getSiteContent("earnings_intro"),
    getSiteContent("earnings_methodology"),
  ]);

  const stats = summarizeCorpus(events);

  return (
    <>
      <section className="border-b border-border">
        <Container className="py-24 sm:py-32 max-w-3xl">
          <Heading level={1}>What Alphabet says</Heading>
          <p className="mt-3 text-muted text-base">
            The first-party record on Waymo, quote by quote, silence by silence.
          </p>
          <div className="mt-10">
            <MarkdownBody content={intro?.markdown_body ?? INTRO_FALLBACK} />
          </div>
        </Container>
      </section>

      {/* Corpus figures are derived, never written into copy: the 2.2 rule.
          A reader who wants to know whether this page is current can read the
          latest document date rather than trusting a "last updated" string. */}
      <section className="border-b border-border bg-surface">
        <Container className="py-10">
          {stats.documents === 0 ? (
            <p className="font-serif text-[1.75rem] leading-tight text-foreground max-w-2xl">
              No Alphabet documents have been ingested yet. The timeline appears once the
              filing and transcript scrapers have run.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Documents read</dt>
                <dd className="mt-1 font-serif text-2xl text-foreground tabular-nums">{stats.documents}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Approved statements</dt>
                <dd className="mt-1 font-serif text-2xl text-foreground tabular-nums">{stats.approvedMentions}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Published figures</dt>
                <dd className="mt-1 font-serif text-2xl text-foreground tabular-nums">{stats.promotedMetrics}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Most recent document</dt>
                <dd className="mt-1 text-base text-foreground">
                  {stats.latestDate ? formatEventDate(stats.latestDate) : "none"}
                </dd>
              </div>
            </dl>
          )}
          {stats.awaitingReview > 0 && (
            <p className="mt-6 text-sm text-muted">
              {stats.awaitingReview}{" "}
              {stats.awaitingReview === 1 ? "document has" : "documents have"} been ingested but not
              yet reviewed, and {stats.awaitingReview === 1 ? "is" : "are"} listed below without
              quotes. Nothing is published from a document until it has been checked by hand.
            </p>
          )}
        </Container>
      </section>

      <section id="posture" className="border-b border-border scroll-mt-20">
        <Container className="py-20 sm:py-24">
          <Heading level={2}>How the talking changed</Heading>
          <DisclosurePosture events={events} />
        </Container>
      </section>

      <section id="timeline" className="border-b border-border scroll-mt-20">
        <Container className="py-20 sm:py-24">
          <Heading level={2}>The record</Heading>
          <p className="mt-3 mb-12 text-muted text-base max-w-2xl">
            Newest first, grouped by the quarter each document reports on. Annual reports are
            grouped with the quarter they are filed beside and keep their own label.
          </p>

          {events.length === 0 ? (
            <p className="font-serif text-[1.75rem] leading-tight text-foreground max-w-2xl">
              Nothing to show yet.
            </p>
          ) : (
            /* The fallback is the full unfiltered record, server rendered, so
               the static HTML carries everything even though the filter needs
               useSearchParams and therefore a boundary. */
            <Suspense fallback={<TimelineGroups events={events} />}>
              <EarningsTimeline events={events} />
            </Suspense>
          )}
        </Container>
      </section>

      <section id="method" className="scroll-mt-20">
        <Container className="py-16 sm:py-20 max-w-3xl">
          <h2 className="font-serif text-xl text-foreground">How these quotes are produced</h2>
          <div className="mt-4 text-sm text-muted leading-relaxed">
            <MarkdownBody
              content={method?.markdown_body ?? METHOD_FALLBACK}
              className="[&_p]:text-sm [&_p]:text-muted"
            />
          </div>
          <p className="mt-6 text-xs text-muted">
            {stats.models.length > 0 && (
              <>
                Extraction model{stats.models.length > 1 ? "s" : ""}: {stats.models.join(", ")}. Recorded on
                every document so a re-run with a newer model is traceable.{" "}
              </>
            )}
            Terms: <Term term="other_bets">Other Bets</Term>,{" "}
            <Term term="weekly_rides">weekly rides</Term>,{" "}
            <Term term="disclosure_quality">disclosure quality</Term>. Full source list on the{" "}
            <Link href="/methodology/sources" className="underline hover:text-foreground transition-colors">
              sources page
            </Link>
            ; site-wide method on the{" "}
            <Link href="/methodology" className="underline hover:text-foreground transition-colors">
              methodology page
            </Link>
            .
          </p>
        </Container>
      </section>
    </>
  );
}
