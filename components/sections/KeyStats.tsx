import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";

async function getCitiesServed(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data: waymo } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();
  if (!waymo) return 0;

  const { count } = await supabase
    .from("cities")
    .select("id", { count: "exact", head: true })
    .eq("company_id", waymo.id)
    .in("status", ["public", "waitlist"]);

  return count ?? 0;
}

export async function KeyStats() {
  const citiesServed = await getCitiesServed();

  return (
    <section className="border-b border-border bg-surface">
      <Container className="py-16 sm:py-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col gap-1">
            <span className="font-serif text-[3.75rem] leading-none font-normal text-foreground tabular-nums">
              {citiesServed}
            </span>
            <p className="text-sm font-medium text-foreground tracking-wide uppercase">
              Cities served
            </p>
          </div>
          <p className="text-sm text-muted max-w-sm leading-relaxed">
            Live operational data including fleet size, weekly rides, and autonomous miles comes online with the operations scraper.
          </p>
        </div>
      </Container>
    </section>
  );
}
