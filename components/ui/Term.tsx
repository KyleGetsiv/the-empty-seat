"use client";

import { ReactNode } from "react";
import { Tooltip } from "./Tooltip";
import { glossary, GlossaryKey } from "@/lib/glossary";

interface TermProps {
  term: GlossaryKey;
  children: ReactNode;
}

function TermTooltipContent({ termKey }: { termKey: GlossaryKey }) {
  const entry = glossary[termKey];
  if (!entry) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-medium text-foreground">{entry.term}</p>
      <p>{entry.shortDefinition}</p>
      {entry.longDefinition && (
        <p className="text-xs text-muted leading-relaxed">
          {entry.longDefinition}
        </p>
      )}
      {entry.seeAlso && entry.seeAlso.length > 0 && (
        <p className="text-xs text-muted">
          See also:{" "}
          {entry.seeAlso
            .map((key) => glossary[key as GlossaryKey]?.term ?? key)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

export function Term({ term, children }: TermProps) {
  const entry = glossary[term];
  if (!entry) return <>{children}</>;

  return (
    <Tooltip content={<TermTooltipContent termKey={term} />}>
      <span
        className="border-b border-dotted border-muted cursor-help"
        aria-label={`${String(children)}: ${entry.shortDefinition}`}
      >
        {children}
      </span>
    </Tooltip>
  );
}
