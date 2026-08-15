"use client";

// OperatorTable: one row per deployment program (the thing on the road),
// operators as rows because the count exceeds the horizontal budget for
// columns. Every metric cell carries its as-of date via the row; empty
// cells render "not disclosed" because the emptiness is information.
// Disclosure quality and supervision are visible per row, per the site's
// attribution principle.

import { Tooltip } from "@/components/ui/Tooltip";
import { Term } from "@/components/ui/Term";
import {
  type LandscapeProgram,
  type DisclosureQuality,
  type Supervision,
  SUPERVISION_LABEL,
  QUALITY_LABEL,
  ROLE_LABEL,
} from "@/lib/landscape-types";

function fmtInt(n: number | null): string | null {
  return n == null ? null : n.toLocaleString("en-US");
}

function fmtCompact(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString("en-US");
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const QUALITY_STYLE: Record<DisclosureQuality, string> = {
  regulatory: "border-accent text-accent",
  earnings_disclosed: "border-accent/60 text-accent",
  company_disclosed: "border-border text-foreground",
  press_reported: "border-dashed border-muted text-muted",
  estimated: "border-dashed border-muted text-muted",
};

const SUPERVISION_STYLE: Record<Supervision, string> = {
  driverless: "bg-accent/10 text-accent",
  mixed: "bg-surface border border-border text-foreground",
  safety_operator: "bg-surface border border-border text-muted",
  human_is_legal_driver: "bg-border text-muted",
};

function Cell({
  value,
  approx,
}: {
  value: string | null;
  approx?: boolean;
}) {
  if (value == null) {
    return <span className="text-muted/70 text-xs italic">not disclosed</span>;
  }
  return (
    <span className="tabular-nums">
      {approx ? "~" : ""}
      {value}
    </span>
  );
}

export function OperatorTable({ programs }: { programs: LandscapeProgram[] }) {
  // Sort: driverless public first, then by weekly rides desc, then vehicles.
  const sorted = [...programs].sort((a, b) => {
    const sa = a.snapshot;
    const sb = b.snapshot;
    const pa = (sa?.cities_serving_public ?? 0) > 0 ? 1 : 0;
    const pb = (sb?.cities_serving_public ?? 0) > 0 ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const ra = sa?.weekly_rides ?? -1;
    const rb = sb?.weekly_rides ?? -1;
    if (ra !== rb) return rb - ra;
    return (sb?.vehicle_count ?? -1) - (sa?.vehicle_count ?? -1);
  });

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[880px] text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-3 pr-4 font-medium">Operator</th>
            <th className="py-3 px-3 font-medium">
              <Term term="supervision_level">Supervision</Term>
            </th>
            <th className="py-3 px-3 font-medium text-right">Cities (public)</th>
            <th className="py-3 px-3 font-medium text-right">Vehicles</th>
            <th className="py-3 px-3 font-medium text-right">Weekly rides</th>
            <th className="py-3 px-3 font-medium text-right">Cumulative</th>
            <th className="py-3 px-3 font-medium">
              <Term term="disclosure_quality">Disclosure</Term>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((p) => {
            const s = p.snapshot;
            const partners = p.roles.filter((r) => r.company.slug !== p.lead.slug);
            return (
              <tr key={p.id} className="align-top">
                <td className="py-4 pr-4">
                  <p className="font-serif text-base text-foreground leading-snug">
                    {p.display_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {p.lead.ownership ?? p.lead.display_name}
                  </p>
                  {partners.length > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      {partners
                        .map((r) => `${r.company.display_name} (${ROLE_LABEL[r.role].toLowerCase()})`)
                        .join(", ")}
                    </p>
                  )}
                </td>
                <td className="py-4 px-3">
                  {s?.supervision ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${SUPERVISION_STYLE[s.supervision]}`}
                    >
                      {SUPERVISION_LABEL[s.supervision]}
                    </span>
                  ) : (
                    <Cell value={null} />
                  )}
                </td>
                <td className="py-4 px-3 text-right">
                  {s ? (
                    <Tooltip
                      content={
                        <>
                          {s.cities_serving_public ?? 0} serving public riders
                          {s.cities_operating_total != null &&
                            s.cities_operating_total !== s.cities_serving_public && (
                              <>
                                ; {s.cities_operating_total} operating in total including
                                employee-only or supervised markets
                              </>
                            )}
                          .
                        </>
                      }
                    >
                      <span>
                        <Cell value={fmtInt(s.cities_serving_public)} />
                        {s.cities_operating_total != null &&
                          s.cities_operating_total !== s.cities_serving_public && (
                            <span className="text-muted text-xs"> / {s.cities_operating_total}</span>
                          )}
                      </span>
                    </Tooltip>
                  ) : (
                    <Cell value={null} />
                  )}
                </td>
                <td className="py-4 px-3 text-right">
                  <Cell
                    value={fmtInt(s?.vehicle_count ?? null)}
                    approx={s?.disclosure_quality === "press_reported" || s?.disclosure_quality === "estimated"}
                  />
                </td>
                <td className="py-4 px-3 text-right">
                  <Cell value={fmtCompact(s?.weekly_rides ?? null)} />
                </td>
                <td className="py-4 px-3 text-right">
                  <Cell value={fmtCompact(s?.cumulative_rides ?? null)} />
                </td>
                <td className="py-4 px-3">
                  {s ? (
                    <Tooltip
                      content={
                        <div className="flex flex-col gap-2">
                          <p>{s.notes ?? QUALITY_LABEL[s.disclosure_quality]}</p>
                          <p className="text-xs text-muted">As of {fmtDate(s.snapshot_date)}</p>
                          {s.source && (
                            <a
                              href={s.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent underline hover:text-accent-hover"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {s.source.publisher}
                            </a>
                          )}
                        </div>
                      }
                    >
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-xs whitespace-nowrap ${QUALITY_STYLE[s.disclosure_quality]}`}
                      >
                        {QUALITY_LABEL[s.disclosure_quality]}
                        <span className="ml-1.5 text-muted">{fmtDate(s.snapshot_date)}</span>
                      </span>
                    </Tooltip>
                  ) : (
                    <Cell value={null} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
