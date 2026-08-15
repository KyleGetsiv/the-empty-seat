"use client";

// CpucComparisonChart: Waymo deployment-tier trips vs pilot-tier trips
// (Zoox, Nuro) from the same regulator, same cadence, California only.
// The gap is orders of magnitude, so the chart uses a log scale and says
// so; the honesty about the gap is the point. Regulatory data only: no
// company claims, no press figures.

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CpucComparisonSeries } from "@/lib/landscape-types";

const COLORS: Record<string, string> = {
  waymo: "#1E3A5F",
  zoox: "#7A4A1E",
  "uber-nuro-lucid": "#1E6B4F",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export function CpucComparisonChart({ series }: { series: CpucComparisonSeries[] }) {
  if (series.length === 0) return null;

  // Merge to one row per quarter.
  const quarters = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.period_start)))
  ).sort();
  const rows = quarters.map((ps) => {
    const row: Record<string, string | number | null> = {
      period_start: ps,
      quarter: series.flatMap((s) => s.points).find((p) => p.period_start === ps)?.quarter ?? ps,
    };
    for (const s of series) {
      const pt = s.points.find((p) => p.period_start === ps);
      row[s.key] = pt ? pt.trips : null;
    }
    return row;
  });

  return (
    <div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="quarter"
              tick={{ fontSize: 12, fill: "var(--color-muted)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              scale="log"
              domain={["auto", "auto"]}
              allowDataOverflow
              tickFormatter={fmt}
              tick={{ fontSize: 12, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value, name) => [
                value == null ? "" : `${Number(value).toLocaleString("en-US")} trips`,
                series.find((s) => s.key === String(name))?.label ?? String(name),
              ]}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                fontSize: 13,
              }}
            />
            <Legend
              formatter={(value) => series.find((s) => s.key === String(value))?.label ?? String(value)}
              wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={COLORS[s.key] ?? "#6B6B6B"}
                strokeWidth={2}
                strokeDasharray={s.tier === "pilot" ? "5 4" : undefined}
                dot={{ r: 4, fill: COLORS[s.key] ?? "#6B6B6B", strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-muted">
        Log scale. Solid line: deployment tier (paid public service). Dashed: pilot tier
        (passengers permitted, fares not). Trips per quarter, California only, from CPUC
        quarterly data reports.
      </p>
    </div>
  );
}
