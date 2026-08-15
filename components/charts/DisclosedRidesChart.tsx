"use client";

// DisclosedRidesChart: the national weekly-rides trajectory built from
// point-in-time public disclosures. Disclosures are episodic, so this is
// deliberately a dot-first chart: the line traces the official company
// arc; filled dots are company-disclosed figures, open dots are third-
// party figures (investor letters, media, analysts) that never joined the
// official line. The 1M end-of-2026 target renders as an annotation, not
// a data point.

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

export type DisclosedChartPoint = {
  t: number; // epoch ms of as_of
  dateLabel: string; // e.g. "Mar 2026"
  company: number | null;
  thirdParty: number | null;
  statedBy: string | null;
  attribution: string;
  sourceUrl: string | null;
  sourcePublisher: string | null;
};

const ACCENT = "var(--color-accent)";
const TARGET = 1_000_000;

function fmtRides(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1000)}K`;
}

function monthYear(t: number): string {
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Wraps a dot in an SVG link to its source when one exists, so every data
// point is directly clickable through to the primary source. Zero-trust by
// construction: the provenance lives on the dot, not just the sources page.
function SourceLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactElement;
}) {
  if (!href) return children;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={{ cursor: "pointer" }}
    >
      {children}
    </a>
  );
}

// Filled dot: company-disclosed.
function CompanyDot(props: {
  cx?: number;
  cy?: number;
  value?: number | null;
  payload?: DisclosedChartPoint;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.company == null) return null;
  return (
    <SourceLink
      href={payload.sourceUrl}
      label={`Source for ${payload.dateLabel} disclosure`}
    >
      <circle cx={cx} cy={cy} r={5.5} fill={ACCENT} stroke="none" />
    </SourceLink>
  );
}

// Open dot: third-party figure.
function ThirdPartyDot(props: {
  cx?: number;
  cy?: number;
  payload?: DisclosedChartPoint;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.thirdParty == null) return null;
  return (
    <SourceLink
      href={payload.sourceUrl}
      label={`Source for ${payload.dateLabel} third-party figure`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={5.5}
        fill="var(--color-background)"
        stroke={ACCENT}
        strokeWidth={2}
      />
    </SourceLink>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DisclosedChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const value = p.company ?? p.thirdParty;
  if (value == null) return null;
  const isCompany = p.company != null;
  return (
    <div className="bg-surface border border-border px-4 py-3 text-sm shadow-sm max-w-64">
      <p className="font-medium mb-1">{p.dateLabel}</p>
      <p className="text-foreground">{value.toLocaleString("en-US")} weekly rides</p>
      <p className="text-muted mt-1 text-xs">
        {isCompany ? "Company-disclosed" : "Third-party figure"}
        {p.statedBy ? `: ${p.statedBy}` : ""}
      </p>
      {p.sourceUrl && (
        <p className="text-accent mt-1.5 text-xs">
          Click the dot to open the source
          {p.sourcePublisher ? ` (${p.sourcePublisher})` : ""}
        </p>
      )}
    </div>
  );
}

export function DisclosedRidesChart({ points }: { points: DisclosedChartPoint[] }) {
  if (points.length === 0) return null;

  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const pad = (tMax - tMin) * 0.04;

  return (
    <div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 16, right: 24, bottom: 8, left: 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[tMin - pad, tMax + pad]}
              tickFormatter={monthYear}
              tick={{ fontSize: 12, fill: "var(--color-muted)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
              ticks={points.filter((p) => p.company != null).map((p) => p.t)}
            />
            <YAxis
              tickFormatter={fmtRides}
              domain={[0, TARGET * 1.08]}
              tick={{ fontSize: 12, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={TARGET}
              stroke="var(--color-muted)"
              strokeDasharray="6 4"
              label={{
                value: "1M weekly target, end of 2026",
                position: "insideBottomRight",
                fill: "var(--color-muted)",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="company"
              stroke={ACCENT}
              strokeWidth={2}
              connectNulls
              dot={<CompanyDot />}
              activeDot={{ r: 7, fill: ACCENT, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="thirdParty"
              stroke="none"
              dot={<ThirdPartyDot />}
              activeDot={{
                r: 7,
                fill: "var(--color-background)",
                stroke: ACCENT,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-muted" aria-hidden="true">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle mr-1.5" />
        Company-disclosed
        <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-accent bg-background align-middle ml-5 mr-1.5" />
        Third-party (investor, media)
      </p>
    </div>
  );
}
