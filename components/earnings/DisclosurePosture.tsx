// components/earnings/DisclosurePosture.tsx
//
// How Alphabet's disclosure about Waymo shifts quarter to quarter (4.6b).
//
// A real table rather than a chart, for two reasons. The counts are small
// enough that a stacked bar would be a row of slivers, and on this site an
// empty cell is a claim: a quarter where Alphabet filed and said nothing is
// the finding, and it has to read as empty rather than as a short bar.
// Shading is decorative, the number is always present, so this degrades to a
// plain data table for a screen reader or a printer.
//
// Server component. No Recharts, no client JavaScript.

import Link from "next/link";
import {
  buildPostureMatrix,
  maxCellCount,
  shadeStep,
  REGISTER_LABELS,
  REGISTER_BLURBS,
  REGISTER_OF,
} from "@/lib/earnings-posture";
import { mentionTypeLabel, metricLabel, formatMetricValue } from "@/lib/earnings-mentions";
import type { PublicEarningsEvent } from "@/lib/earnings-types";

// Static strings so Tailwind can see every class it needs to generate.
const SHADE: Record<number, string> = {
  0: "text-muted/50",
  1: "bg-accent/10 text-foreground",
  2: "bg-accent/25 text-foreground",
  3: "bg-accent/50 text-background",
  4: "bg-accent/75 text-background",
};

export function DisclosurePosture({ events }: { events: PublicEarningsEvent[] }) {
  const matrix = buildPostureMatrix(events);
  const max = maxCellCount(matrix);

  if (matrix.grandTotal === 0) {
    return (
      <p className="font-serif text-[1.75rem] leading-tight text-foreground max-w-2xl">
        Once statements are approved, this is where the shape of Alphabet&apos;s disclosure
        quarter by quarter appears.
      </p>
    );
  }

  const promoted = events.flatMap((event) =>
    event.mentions
      .filter((m) => m.promoted && m.metricSlug && m.metricValue !== null)
      .map((m) => ({ event, mention: m }))
  );

  return (
    <>
      {/* Every figure in this paragraph is derived, per the 2.2 rule. */}
      <p className="mt-3 mb-10 text-muted text-base max-w-2xl">
        Across {matrix.quarters.length} quarters, Waymo comes up{" "}
        <span className="text-foreground">{matrix.grandTotal}</span> times in language Alphabet
        chose.{" "}
        {matrix.dominant && (
          <>
            Most of it is{" "}
            <span className="text-foreground">
              {REGISTER_LABELS[matrix.dominant.register].toLowerCase()}
            </span>{" "}
            ({matrix.dominant.total} of {matrix.grandTotal}).{" "}
          </>
        )}
        {matrix.peak && (
          <>
            The talkiest quarter is{" "}
            <span className="text-foreground">{matrix.peak.key}</span>, with {matrix.peak.total}.{" "}
          </>
        )}
        {matrix.silentQuarters.length > 0 && (
          <>
            In {matrix.silentQuarters.length}{" "}
            {matrix.silentQuarters.length === 1 ? "quarter" : "quarters"} (
            {matrix.silentQuarters.map((q) => q.key).join(", ")}) Alphabet filed and said nothing
            about Waymo that survived review.
          </>
        )}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">
            Approved statements about Waymo by register and fiscal quarter
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-background px-3 py-2 text-left font-medium text-muted">
                Register
              </th>
              {matrix.quarters.map((q) => (
                <th
                  key={q.key}
                  scope="col"
                  className="px-2 py-2 text-center text-xs font-medium text-muted whitespace-nowrap"
                  title={`${q.documents} ${q.documents === 1 ? "document" : "documents"}, ${q.total} approved`}
                >
                  {q.key}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-muted">
                All
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.register} className="border-t border-border">
                <th
                  scope="row"
                  className="sticky left-0 bg-background px-3 py-2 text-left font-normal text-foreground whitespace-nowrap"
                  title={REGISTER_BLURBS[row.register]}
                >
                  {REGISTER_LABELS[row.register]}
                </th>
                {row.cells.map((cell) => (
                  <td
                    key={cell.quarterKey}
                    className={`px-2 py-2 text-center tabular-nums ${SHADE[shadeStep(cell.count, max)]}`}
                    title={
                      cell.count === 0
                        ? `${cell.quarterKey}: none`
                        : `${cell.quarterKey}: ${cell.byType
                            .map((t) => `${t.count} ${mentionTypeLabel(t.type).toLowerCase()}`)
                            .join(", ")}`
                    }
                  >
                    {cell.count === 0 ? "·" : cell.count}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums text-muted">{row.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <th scope="row" className="sticky left-0 bg-background px-3 py-2 text-left font-normal text-muted">
                Documents
              </th>
              {matrix.quarters.map((q) => (
                <td key={q.key} className="px-2 py-2 text-center tabular-nums text-muted">
                  {q.documents}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums text-muted">{events.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {promoted.length > 0 && (
        <div className="mt-10">
          <h3 className="text-xs uppercase tracking-wide font-medium text-muted">
            Figures this pipeline published
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Of {matrix.grandTotal} approved statements, {promoted.length} carried a number that
            became a disclosed metric. That ratio is the honest summary of what an earnings call
            yields: Alphabet talks about Waymo far more often than it quantifies it.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {promoted.map(({ event, mention }) => (
              <li key={mention.id} className="flex flex-wrap items-baseline gap-x-3 text-muted">
                <span className="font-serif text-base text-foreground tabular-nums">
                  {formatMetricValue(mention.metricValue!, mention.metricUnit, mention.metricSlug)}
                </span>
                <span>{metricLabel(mention.metricSlug!)}</span>
                <Link
                  href={`/earnings/${event.slug}`}
                  className="underline decoration-border underline-offset-2 hover:text-foreground transition-colors"
                >
                  {event.fiscalPeriod}
                </Link>
                {mention.speaker && <span className="text-xs">{mention.speaker}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 max-w-2xl text-xs text-muted leading-relaxed">
        Registers group the eleven mention types the extraction schema uses:{" "}
        {Object.entries(REGISTER_LABELS).map(([reg, label], i, arr) => (
          <span key={reg}>
            <span className="text-foreground">{label.toLowerCase()}</span> is{" "}
            {Object.entries(REGISTER_OF)
              .filter(([, r]) => r === reg)
              .map(([type]) => mentionTypeLabel(type).toLowerCase())
              .join(", ")}
            {i < arr.length - 1 ? "; " : ". "}
          </span>
        ))}
        The grouping is an editorial choice; hover any cell for its unrounded breakdown. Counts are
        approved statements, not documents, so one filing can contribute several.
      </p>
    </>
  );
}
