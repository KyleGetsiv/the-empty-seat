import { PageShell } from "@/components/sections/PageShell";
import { ThesisHero } from "@/components/sections/ThesisHero";
import { Thesis } from "@/components/sections/Thesis";
import { KeyStats } from "@/components/sections/KeyStats";
import { NationalTrajectory } from "@/components/sections/NationalTrajectory";
import { Operations } from "@/components/sections/Operations";
import { RecentMilestones } from "@/components/sections/RecentMilestones";

export const revalidate = 3600;

export default function Home() {
  return (
    <PageShell>
      <ThesisHero />
      <Thesis />
      <KeyStats />
      <NationalTrajectory />
      <Operations />
      <RecentMilestones />
    </PageShell>
  );
}
