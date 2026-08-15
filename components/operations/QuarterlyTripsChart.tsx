"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { Term } from "@/components/ui/Term";
import {
  parseQuarterLabel,
  nextQuarter,
  quarterLabel,
  filingDeadlineLabel,
} from "@/lib/cpuc-calendar";

export type ChartDataPoint = {
  label: string;
  trips: number;
  qoqGrowth: number | null;
};

// Sums trips for the most recent calendar year with all four quarters
// present. Returns null when no complete year exists in the data.
function latestCompleteYear(
  data: ChartDataPoint[]
): { year: number; trips: number } | null {
  const byYear = new Map<number, { count: number; trips: number }>();
  for (const d of data) {
    const qt = parseQuarterLabel(d.label);
    if (!qt) continue;
    const agg = byYear.get(qt.year) ?? { count: 0, trips: 0 };
    agg.count++;
    agg.trips += d.trips;
    byYear.set(qt.year, agg);
  }
  const complete = [...byYear.entries()]
    .filter(([, v]) => v.count === 4)
    .sort((a, b) => b[0] - a[0]);
  return complete.length > 0
    ? { year: complete[0][0], trips: complete[0][1].trips }
    : null;
}

function fmtGrowth(g: number): string {
  return `${g >= 0 ? "+" : ""}${g.toFixed(1)}%`;
}

function formatTrips(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return n.toLocaleString("en-US");
}

function yAxisFormatter(value: number): string {
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  return `${(value / 1_000).toFixed(0)}K`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-surface border border-border px-4 py-3 text-sm shadow-sm">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-foreground">{formatTrips(point.trips)} trips</p>
      {point.qoqGrowth !== null && (
        <p className="text-muted mt-1">
          {fmtGrowth(point.qoqGrowth)} vs prior quarter
        </p>
      )}
    </div>
  );
}

export function QuarterlyTripsChart({ data }: { data: ChartDataPoint[] }) {
  if (data.length === 0) {
    return (
      <section aria-label="Quarterly trips chart" className="py-16 sm:py-20">
        {/* TODO: user to replace with final copy */}
        <p className="font-serif text-[2.25rem] sm:text-[3rem] leading-tight font-normal text-foreground max-w-2xl">
          California CPUC quarterly filing data loads here when the scraper has run.
          Chart will plot trips per quarter from disclosed CPUC filings, California only.
        </p>
      </section>
    );
  }

  const latest = data[data.length - 1];
  const completeYear = latestCompleteYear(data);
  const growthClause =
    latest.qoqGrowth !== null ? (
      <>
        {latest.qoqGrowth >= 0 ? "growing" : "declining"}{" "}
        <strong className="font-medium">
          {Math.abs(latest.qoqGrowth).toFixed(1)}%
        </strong>{" "}
        quarter over quarter in {latest.label}.{" "}
      </>
    ) : null;

  return (
    <section aria-label="Quarterly trips chart" className="py-16 sm:py-20">
      {/* TODO: user to replace with final copy */}
      <p className="text-base text-foreground max-w-2xl mb-10 leading-relaxed">
        {completeYear ? (
          <>
            Waymo completed{" "}
            <strong className="font-medium">{formatTrips(completeYear.trips)}</strong>{" "}
            trips in California in {completeYear.year},{" "}
          </>
        ) : (
          <>
            Waymo&apos;s California trip volume is charted below by quarter,{" "}
          </>
        )}
        {growthClause}
        California is Waymo&apos;s largest and most closely regulated market, and the only state
        where quarterly trip data is publicly disclosed. See the{" "}
        <a
          href="/methodology"
          className="underline text-foreground hover:text-accent transition-colors"
        >
          methodology page
        </a>
        {" "}for source details and a pointer to live community-tracked data.
      </p>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "var(--color-muted)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={yAxisFormatter}
              tick={{ fontSize: 12, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="trips"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={<Dot r={5} fill="var(--color-accent)" strokeWidth={0} />}
              activeDot={{ r: 7, fill: "var(--color-accent)", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-xs text-muted">
        Data through {latest.label}.{" "}
        <Term term="cpuc">CPUC</Term> files quarterly
        {(() => {
          const qt = parseQuarterLabel(latest.label);
          if (!qt) return null;
          const nq = nextQuarter(qt);
          return (
            <>
              ; {quarterLabel(nq)} figures are due to CPUC by{" "}
              {filingDeadlineLabel(nq)}
            </>
          );
        })()}
        . California only.
      </p>
    </section>
  );
}
