import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { ThesisHeroCounter } from "./ThesisHeroCounter";

async function getWaymoCompanyId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", "waymo")
    .single();
  return data?.id ?? null;
}

async function getLatestCompanyWideRides(companyId: string): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ride_estimates")
    .select("rides_per_week")
    .eq("company_id", companyId)
    .is("city_id", null)
    .order("period_end", { ascending: false })
    .limit(1)
    .single();
  return data?.rides_per_week ?? null;
}

export async function ThesisHero() {
  const companyId = await getWaymoCompanyId();
  const ridesPerWeek = companyId ? await getLatestCompanyWideRides(companyId) : null;

  return (
    <section id="thesis" className="border-b border-border">
      <Container className="py-24 sm:py-32">
        {ridesPerWeek !== null ? (
          <div className="flex flex-col gap-3">
            <ThesisHeroCounter target={ridesPerWeek} />
            <p className="text-muted text-sm tracking-wide uppercase">
              Estimated weekly rides
            </p>
          </div>
        ) : (
          // TODO: remove when 1.3 ships
          <p className="font-serif text-[2.25rem] sm:text-[3rem] leading-tight font-normal text-foreground max-w-2xl">
            Tracking Waymo&apos;s weekly ride count, fleet size, and city expansion.
          </p>
        )}
      </Container>
    </section>
  );
}
