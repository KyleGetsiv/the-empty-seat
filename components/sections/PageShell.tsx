import { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getGlobalLastUpdated } from "@/lib/last-updated";
import { format } from "date-fns";

const navLinks = [
  { label: "Thesis", href: "/#thesis" },
  { label: "Operations", href: "/#operations" },
  { label: "Milestones", href: "/#milestones" },
  { label: "Unit Economics", href: "/unit-economics" },
  { label: "Financials", href: "/financials" },
  { label: "Earnings", href: "/earnings" },
  { label: "Landscape", href: "/landscape" },
  { label: "Safety", href: "/safety" },
  { label: "Outlook", href: "/outlook" },
];

interface PageShellProps {
  children: ReactNode;
}

export async function PageShell({ children }: PageShellProps) {
  const lastUpdatedDate = await getGlobalLastUpdated();
  const lastUpdated = lastUpdatedDate ? format(lastUpdatedDate, "MMMM d, yyyy") : null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <Container>
          <div className="flex h-14 items-center justify-between gap-8">
            <Link
              href="/"
              className="font-serif text-[1.0625rem] font-normal tracking-tight text-foreground hover:text-accent transition-colors whitespace-nowrap"
            >
              The Empty Seat
            </Link>
            <nav
              aria-label="Main navigation"
              className="hidden lg:flex items-center gap-6 overflow-x-auto"
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted hover:text-foreground transition-colors whitespace-nowrap"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/methodology"
                className="text-sm text-muted hover:text-foreground transition-colors whitespace-nowrap opacity-70"
              >
                Methodology
              </a>
            </nav>
            {/* Mobile: abbreviated */}
            <nav
              aria-label="Mobile navigation"
              className="lg:hidden flex items-center gap-4 overflow-x-auto text-sm"
            >
              {navLinks.slice(0, 4).map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-muted hover:text-foreground transition-colors whitespace-nowrap"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </Container>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-24 border-t border-border bg-surface">
        <Container className="py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="font-serif text-base text-foreground">
                The Empty Seat
              </p>
              <p className="text-sm text-muted max-w-md leading-relaxed">
                The Empty Seat is an independent research project. Not affiliated
                with Waymo, Alphabet, or any mentioned company. Not investment
                advice.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted sm:text-right">
              <a
                href="/methodology"
                className="hover:text-foreground transition-colors"
              >
                Methodology
              </a>
              <a
                href="mailto:getsivkyle@gmail.com"
                className="hover:text-foreground transition-colors"
              >
                Contact
              </a>
              {lastUpdated && (
                <p className="mt-1 text-xs text-muted">
                  Last updated: {lastUpdated}
                </p>
              )}
            </div>
          </div>
        </Container>
      </footer>
    </>
  );
}
