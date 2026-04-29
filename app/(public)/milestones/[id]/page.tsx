import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { tagLabel } from "@/lib/milestones/tags";
import Link from "next/link";

export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function MilestoneDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, event_date, headline, body, tags, kyle_annotation, is_published, source_id")
    .eq("id", id)
    .single();

  if (!milestone || !milestone.is_published) notFound();

  let sourceUrl: string | null = null;
  let sourceTitle: string | null = null;
  let sourcePublisher: string | null = null;
  if (milestone.source_id) {
    const { data: source } = await supabase
      .from("sources")
      .select("url, title, publisher")
      .eq("id", milestone.source_id)
      .single();
    if (source) {
      sourceUrl = source.url;
      sourceTitle = source.title;
      sourcePublisher = source.publisher;
    }
  }

  return (
    <article>
      <Container className="py-24 sm:py-32 max-w-3xl">
        <Link
          href="/milestones"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          &larr; All milestones
        </Link>

        <div className="mt-8 flex items-center gap-3 flex-wrap">
          <time dateTime={milestone.event_date} className="text-sm text-muted tabular-nums">
            {formatDate(milestone.event_date)}
          </time>
          {milestone.tags && milestone.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(milestone.tags as string[]).map((tag) => (
                <Link
                  key={tag}
                  href={`/milestones?tag=${tag}`}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted hover:border-foreground hover:text-foreground transition-colors"
                >
                  {tagLabel(tag)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <h1 className="mt-4 font-serif text-3xl sm:text-4xl leading-tight text-foreground">
          {milestone.headline}
        </h1>

        {milestone.body && (
          <Prose className="mt-8">
            {(milestone.body as string).split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </Prose>
        )}

        {milestone.kyle_annotation && (
          <div className="mt-8 border-l-2 border-accent pl-4">
            <p className="text-sm italic text-muted">{milestone.kyle_annotation}</p>
          </div>
        )}

        {sourceUrl && (
          <div className="mt-10 pt-8 border-t border-border">
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">Source</p>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent underline hover:text-accent-hover transition-colors"
            >
              {sourceTitle ?? sourceUrl}
            </a>
            {sourcePublisher && (
              <span className="text-sm text-muted ml-2">({sourcePublisher})</span>
            )}
          </div>
        )}
      </Container>
    </article>
  );
}
