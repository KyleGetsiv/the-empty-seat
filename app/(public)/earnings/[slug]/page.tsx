import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Term } from "@/components/ui/Term";
import { MentionQuote } from "@/components/earnings/MentionQuote";
import { TableReading } from "@/components/earnings/TableReading";
import {
  getEarningsEventBySlug,
  getEarningsEventIndex,
} from "@/lib/earnings-public";
import { eventTypeLabel, eventTypeShort, formatEventDate } from "@/lib/earnings-mentions";
import { PRESENCE_COPY } from "@/lib/earnings-types";
import { partitionMentions, describeMentionMix } from "@/lib/earnings-table";

export const revalidate = 3600;

// 33 events, so pre-rendering every permalink at build time is cheap. It also
// surfaces a slug collision at build rather than at request time: two events
// generating the same slug show up here as a duplicate param.
export async function generateStaticParams() {
  const index = await getEarningsEventIndex();
  return index.map((entry) => ({ slug: entry.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const event = await getEarningsEventBySlug(slug);
  if (!event) return { title: "Not found | The Empty Seat" };

  const title = `${event.filerName} ${event.fiscalPeriod} ${eventTypeShort(event.eventType)} on Waymo`;
  const description =
    event.presence === "has_mentions"
      ? `${describeMentionMix(event.mentions)} about Waymo, verified against ${
          event.filerName
        }'s ${eventTypeLabel(event.eventType).toLowerCase()} of ${formatEventDate(event.eventDate)}.`
      : `${event.filerName}'s ${eventTypeLabel(event.eventType).toLowerCase()} of ${formatEventDate(
          event.eventDate
        )}. ${PRESENCE_COPY[event.presence]}`;

  return {
    title: `${title} | The Empty Seat`,
    description,
  };
}

export default async function EarningsEventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEarningsEventBySlug(slug);
  if (!event) notFound();

  const promoted = event.mentions.filter((m) => m.promoted);
  // Prose and table rows are different kinds of evidence and get different
  // headings. Lumping them under one count called a segment-table cell a
  // statement, which is what made the Q2 2026 10-Q unreadable.
  const { statements, figures } = partitionMentions(event.mentions);

  return (
    <article>
      <Container className="py-24 sm:py-32 max-w-3xl">
        <Link href="/earnings" className="text-sm text-muted hover:text-foreground transition-colors">
          &larr; All documents
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
          <time dateTime={event.eventDate} className="tabular-nums">
            {formatEventDate(event.eventDate)}
          </time>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">
            {eventTypeLabel(event.eventType)}
          </span>
          <span className="text-xs">{event.fiscalPeriod}</span>
        </div>

        <h1 className="mt-4 font-serif text-3xl sm:text-4xl leading-tight text-foreground">
          What {event.filerName} said about {event.subjectName}
        </h1>

        {event.presence === "has_mentions" ? (
          <>
            <p className="mt-4 text-base text-muted">
              {describeMentionMix(event.mentions)} approved for publication
              {promoted.length > 0 && (
                <>
                  , {promoted.length} of which {promoted.length === 1 ? "carries a figure" : "carry figures"}{" "}
                  published as disclosed metrics
                </>
              )}
              .
              {!event.reviewComplete && " Others from this document are still in the review queue."}
            </p>

            {statements.length > 0 && (
              <section className="mt-12">
                <h2 className="text-xs uppercase tracking-wide font-medium text-muted">
                  {statements.length === 1 ? "Statement" : "Statements"}
                </h2>
                <div className="mt-6 flex flex-col gap-10">
                  {statements.map((m) => (
                    <MentionQuote key={m.id} mention={m} />
                  ))}
                </div>
              </section>
            )}

            {figures.length > 0 && (
              <section className="mt-14">
                <h2 className="text-xs uppercase tracking-wide font-medium text-muted">
                  {figures.length === 1 ? "Figure from the tables" : "Figures from the tables"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted">
                  Read out of this filing&apos;s financial tables rather than spoken or written in
                  prose. Each one shows the figure, the labels the table gave it, and the row exactly
                  as filed.
                </p>
                <div className="mt-6 flex flex-col gap-10">
                  {figures.map((m) => (
                    <TableReading key={m.id} mention={m} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="mt-6 font-serif text-[1.5rem] sm:text-[1.75rem] leading-snug text-foreground">
            {PRESENCE_COPY[event.presence]}
          </p>
        )}

        {/* Provenance. The extraction figures are the audit trail: a document
            read in zero chunks contains no Waymo passages at all, which is a
            different fact from a document that was read and yielded nothing. */}
        <div className="mt-16 border-t border-border pt-8">
          <h2 className="text-xs uppercase tracking-wide font-medium text-muted">Provenance</h2>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            {event.sourceUrl && (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="text-muted sm:w-40 sm:shrink-0">Primary source</dt>
                <dd>
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline hover:text-accent-hover transition-colors"
                  >
                    {event.sourceTitle ?? event.sourceUrl}
                  </a>
                  {event.sourcePublisher && (
                    <span className="ml-2 text-muted">({event.sourcePublisher})</span>
                  )}
                </dd>
              </div>
            )}
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="text-muted sm:w-40 sm:shrink-0">Filer</dt>
              <dd className="text-foreground">{event.filerName}</dd>
            </div>
            {event.extractionModel && (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="text-muted sm:w-40 sm:shrink-0">Extraction</dt>
                <dd className="text-foreground">
                  {event.extractionModel}
                  {event.extractionVersion !== null ? `, schema v${event.extractionVersion}` : ""}
                  {event.extractionChunks !== null && (
                    <>
                      {" "}
                      &middot;{" "}
                      {event.extractionChunks === 0
                        ? "no Waymo or Other Bets passages found in the document"
                        : `${event.extractionChunks} passage ${
                            event.extractionChunks === 1 ? "chunk" : "chunks"
                          } read`}
                    </>
                  )}
                </dd>
              </div>
            )}
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="text-muted sm:w-40 sm:shrink-0">Review</dt>
              <dd className="text-foreground">
                {event.reviewComplete
                  ? "Complete. Every extracted statement was accepted or rejected by hand."
                  : "In progress. Only statements already approved appear above."}
              </dd>
            </div>
          </dl>

          <p className="mt-6 text-xs text-muted leading-relaxed">
            Quotes are matched character by character against the stored source document before they
            are saved; anything the model returned that does not appear verbatim is discarded rather
            than corrected. Figures marked published are promoted to{" "}
            <Term term="disclosure_quality">company-disclosed</Term> metrics and drive the charts
            elsewhere on this site. Method in full on the{" "}
            <Link href="/earnings#method" className="underline hover:text-foreground transition-colors">
              earnings page
            </Link>
            .
          </p>
        </div>
      </Container>
    </article>
  );
}
