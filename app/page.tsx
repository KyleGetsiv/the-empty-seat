import { PageShell } from "@/components/sections/PageShell";
import { ThesisHero } from "@/components/sections/ThesisHero";
import { Thesis } from "@/components/sections/Thesis";
import { KeyStats } from "@/components/sections/KeyStats";

export const revalidate = 3600;

export default function Home() {
  return (
    <PageShell>
      <ThesisHero />
      <Thesis />
      <KeyStats />
    </PageShell>
  );
}
