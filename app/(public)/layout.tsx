import { ReactNode } from "react";
import { PageShell } from "@/components/sections/PageShell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
