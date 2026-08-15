// SupervisionStrip: the page's core editorial argument as UI. Sorts every
// program into one of three bands by what its latest snapshot says about
// who is in the driver's seat and whether the public can pay for a ride.

import { Term } from "@/components/ui/Term";
import { type LandscapeProgram, isDriverlessPublic } from "@/lib/landscape-types";

function band(p: LandscapeProgram): "driverless_public" | "supervised_or_limited" | "legal_driver" {
  const s = p.snapshot;
  if (s?.supervision === "human_is_legal_driver") return "legal_driver";
  if (isDriverlessPublic(p)) return "driverless_public";
  return "supervised_or_limited";
}

function Column({
  title,
  subtitle,
  items,
  accent,
}: {
  title: string;
  subtitle: string;
  items: LandscapeProgram[];
  accent: boolean;
}) {
  return (
    <div className={`flex-1 rounded-md border p-5 ${accent ? "border-accent/40 bg-accent/5" : "border-border bg-surface"}`}>
      <p className="font-serif text-lg text-foreground leading-snug">{title}</p>
      <p className="mt-1 text-xs text-muted leading-relaxed">{subtitle}</p>
      <ul className="mt-4 flex flex-col gap-1.5">
        {items.length === 0 && <li className="text-sm text-muted italic">none</li>}
        {items.map((p) => (
          <li key={p.id} className="text-sm text-foreground">
            {p.display_name}
            {p.snapshot?.supervision === "mixed" && (
              <span className="text-muted text-xs"> (mixed by market)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SupervisionStrip({ programs }: { programs: LandscapeProgram[] }) {
  const groups = {
    driverless_public: programs.filter((p) => band(p) === "driverless_public"),
    supervised_or_limited: programs.filter((p) => band(p) === "supervised_or_limited"),
    legal_driver: programs.filter((p) => band(p) === "legal_driver"),
  };

  return (
    <div>
      <p className="mb-5 text-base text-foreground max-w-2xl leading-relaxed">
        The question that separates the field is not how many cities an operator
        names but who is in the driver&apos;s seat when a paying member of the
        public gets in. Programs are grouped below by their{" "}
        <Term term="supervision_level">supervision level</Term> in the markets
        where they actually serve riders.
      </p>
      <div className="flex flex-col gap-4 md:flex-row">
        <Column
          title="Driverless, public, paid"
          subtitle="No one in the driver's seat; anyone can hail and pay. In at least one market."
          items={groups.driverless_public}
          accent
        />
        <Column
          title="Supervised, or not yet public"
          subtitle="Safety operator onboard, employee-only riders, free rides, or testing."
          items={groups.supervised_or_limited}
          accent={false}
        />
        <Column
          title="Human is the legal driver"
          subtitle="Regulator classifies the person in the seat as the driver; not an AV service under state law."
          items={groups.legal_driver}
          accent={false}
        />
      </div>
    </div>
  );
}
