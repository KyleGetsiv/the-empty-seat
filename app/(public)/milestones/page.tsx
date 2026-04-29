import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { MilestoneCard } from "@/components/milestones/MilestoneCard";
import { MILESTONE_TAGS, tagLabel } from "@/lib/milestones/tags";
import Link from "next/link";

export const revalidate = 3600;

type Props = {
  searchParams: Promise<{ tag?: string }>;
};

export default async function MilestonesPage({ searchParams }: Props) {
  const { tag } = await searchParams;
  const activeTag = MILESTONE_TAGS.includes(tag as (typeof MILESTONE_TAGS)[number]) ? tag : undefined;

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("milestones")
    .select("id, event_date, headline, body, tags, kyle_annotation")
    .eq("is_published", true)
    .order("event_date", { ascending: false });

  if (activeTag) {
    query = query.contains("tags", [activeTag]);
  }

  const { data } = await query;
  const milestones = data ?? [];

  return (
    <section>
      <Container className="py-24 sm:py-32">
        <Heading level={1}>Milestones</Heading>
        {/* TODO: user to replace with section intro copy */}
        <p className="mt-3 text-muted text-base max-w-2xl">
          A chronological record of significant events in Waymo&apos;s commercial history, from city launches
          to regulatory developments to scale milestones.
        </p>

        {/* Tag filter chips */}
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/milestones"
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              !activeTag
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            All
          </Link>
          {MILESTONE_TAGS.map((t) => (
            <Link
              key={t}
              href={`/milestones?tag=${t}`}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                activeTag === t
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              {tagLabel(t)}
            </Link>
          ))}
        </div>

        {milestones.length === 0 ? (
          <p className="mt-16 text-muted text-base">No milestones found.</p>
        ) : (
          <div className="mt-8">
            {milestones.map((m) => (
              <MilestoneCard key={m.id} milestone={m} linked />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
