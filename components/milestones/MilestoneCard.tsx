import Link from "next/link";
import { tagLabel } from "@/lib/milestones/tags";

export type MilestoneCardData = {
  id: string;
  event_date: string;
  headline: string;
  body: string | null;
  tags: string[] | null;
  kyle_annotation: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function MilestoneCard({ milestone, linked = true }: { milestone: MilestoneCardData; linked?: boolean }) {
  const dateStr = formatDate(milestone.event_date);

  const inner = (
    <article className="group flex flex-col gap-3 border-b border-border py-8 last:border-0">
      <div className="flex items-center gap-3 flex-wrap">
        <time dateTime={milestone.event_date} className="text-sm text-muted tabular-nums shrink-0">
          {dateStr}
        </time>
        {milestone.tags && milestone.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {milestone.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted"
              >
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        )}
      </div>

      <h3 className="font-serif text-xl leading-snug text-foreground group-hover:text-accent transition-colors">
        {milestone.headline}
      </h3>

      {milestone.body && (
        <p className="text-base text-muted leading-relaxed line-clamp-3">
          {milestone.body}
        </p>
      )}

      {milestone.kyle_annotation && (
        <p className="text-sm italic text-muted border-l-2 border-accent pl-3">
          {milestone.kyle_annotation}
        </p>
      )}
    </article>
  );

  if (!linked) return inner;

  return (
    <Link href={`/milestones/${milestone.id}`} className="block no-underline">
      {inner}
    </Link>
  );
}
