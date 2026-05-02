import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestDisclosedWeeklyRides } from "@/lib/disclosed-metrics";
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

async function getLatestCpucRides(companyId: string): Promise<number | null> {
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

function formatDisclosedDate(date: Date): string {
  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

export async function ThesisHero() {
  const disclosed = await getLatestDisclosedWeeklyRides();

  let target: number | null = null;
  let caption: string;

  if (disclosed) {
    target = disclosed.value;
    caption = `WEEKLY RIDES, AS OF ${formatDisclosedDate(disclosed.as_of)}`;
  } else {
    const companyId = await getWaymoCompanyId();
    if (companyId) target = await getLatestCpucRides(companyId);
    caption = "ESTIMATED WEEKLY RIDES";
  }

  return (
    <section id="thesis" className="border-b border-border">
      <Container className="py-24 sm:py-32">
        {target !== null ? (
          <div className="flex flex-col gap-3">
            <ThesisHeroCounter target={target} />
            <p className="text-muted text-sm tracking-wide uppercase">{caption}</p>
          </div>
        ) : (
          <p className="font-serif text-[2.25rem] sm:text-[3rem] leading-tight font-normal text-foreground max-w-2xl">
            Tracking Waymo&apos;s weekly ride count, fleet size, and city expansion.
          </p>
        )}
      </Container>
    </section>
  );
}
