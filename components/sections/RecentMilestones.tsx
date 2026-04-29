import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { MilestoneCard } from "@/components/milestones/MilestoneCard";
import Link from "next/link";

export async function RecentMilestones() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("milestones")
    .select("id, event_date, headline, body, tags, kyle_annotation")
    .eq("is_published", true)
    .order("event_date", { ascending: false })
    .limit(5);

  const milestones = data ?? [];

  if (milestones.length === 0) return null;

  return (
    <section id="milestones" className="border-b border-border scroll-mt-20">
      <Container className="py-24 sm:py-32">
        <div className="flex items-end justify-between gap-4">
          <Heading level={2}>Milestones</Heading>
          <Link
            href="/milestones"
            className="text-sm text-muted hover:text-foreground transition-colors whitespace-nowrap pb-1"
          >
            View all &rarr;
          </Link>
        </div>

        {/* TODO: user to replace with section intro copy */}
        <p className="mt-3 text-muted text-base max-w-2xl">
          Key moments in Waymo&apos;s commercial history, from city launches to scale milestones.
        </p>

        <div className="mt-4">
          {milestones.map((m) => (
            <MilestoneCard key={m.id} milestone={m} linked />
          ))}
        </div>

        <div className="mt-4">
          <Link
            href="/milestones"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            View all milestones &rarr;
          </Link>
        </div>
      </Container>
    </section>
  );
}
