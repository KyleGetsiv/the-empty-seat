"use client";

import { ReactNode } from "react";
import { Tooltip } from "./Tooltip";

interface MetricProps {
  value: string | number;
  unit?: string;
  explanation: ReactNode;
  sourceUrl?: string;
  asOf?: string;
  className?: string;
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block shrink-0 text-muted"
    >
      <circle cx="7" cy="7" r="6.5" stroke="currentColor" />
      <path
        d="M7 6v4M7 4.5v.01"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MetricTooltipContent({
  explanation,
  sourceUrl,
  asOf,
}: {
  explanation: ReactNode;
  sourceUrl?: string;
  asOf?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p>{explanation}</p>
      {asOf && (
        <p className="text-xs text-muted">As of {asOf}</p>
      )}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent underline hover:text-accent-hover"
          onClick={(e) => e.stopPropagation()}
        >
          Source
        </a>
      )}
    </div>
  );
}

export function Metric({
  value,
  unit,
  explanation,
  sourceUrl,
  asOf,
  className = "",
}: MetricProps) {
  return (
    <Tooltip
      content={
        <MetricTooltipContent
          explanation={explanation}
          sourceUrl={sourceUrl}
          asOf={asOf}
        />
      }
    >
      <span
        className={`inline-flex items-baseline gap-1.5 ${className}`}
        aria-label={`${value}${unit ? ` ${unit}` : ""}. Click for details.`}
      >
        <span className="font-serif text-foreground">{value}</span>
        {unit && (
          <span className="text-sm font-sans text-muted">{unit}</span>
        )}
        <span className="relative top-[-1px]">
          <InfoIcon />
        </span>
      </span>
    </Tooltip>
  );
}
