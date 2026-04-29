import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import Link from "next/link";
import { format, parseISO } from "date-fns";

export const revalidate = 3600;

type SourceRow = {
  id: string;
  url: string;
  title: string;
  publisher: string;
  published_at: string | null;
  created_at: string;
};

function formatPublishedAt(iso: string): string {
  return format(parseISO(iso), "MMM yyyy");
}

export default async function SourcesPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("sources")
    .select("id, url, title, publisher, published_at, created_at")
    .order("created_at", { ascending: false });

  const sources = (data ?? []) as SourceRow[];

  if (sources.length === 0) {
    return (
      <section>
        <Container className="py-24 sm:py-32 max-w-3xl">
          <Heading level={1}>Sources</Heading>
          <p className="mt-8 text-base text-muted">No sources have been cataloged yet.</p>
          <Link href="/methodology" className="mt-8 inline-block text-sm text-muted hover:text-foreground transition-colors">
            &larr; Back to methodology
          </Link>
        </Container>
      </section>
    );
  }

  // Group by publisher
  const grouped: Record<string, SourceRow[]> = {};
  for (const s of sources) {
    if (!grouped[s.publisher]) grouped[s.publisher] = [];
    grouped[s.publisher].push(s);
  }

  // Sort publishers alphabetically
  const publishers = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  // Within each group: published_at DESC, nulls last (then created_at DESC)
  for (const pub of publishers) {
    grouped[pub].sort((a, b) => {
      if (!a.published_at && !b.published_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (!a.published_at) return 1;
      if (!b.published_at) return -1;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });
  }

  return (
    <section>
      <Container className="py-24 sm:py-32 max-w-3xl">
        <Heading level={1}>Sources</Heading>
        {/* TODO: user to replace if desired */}
        <p className="mt-3 text-base text-muted max-w-2xl">
          Every primary source cited on The Empty Seat. Grouped by publisher, sorted by publication date.
        </p>

        <div className="mt-12 flex flex-col gap-12">
          {publishers.map((publisher) => (
            <div key={publisher}>
              <h2 className="font-serif text-xl text-foreground mb-4 pb-3 border-b border-border">
                {publisher}
              </h2>
              <ul className="flex flex-col gap-3">
                {grouped[publisher].map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4">
                    <a
                      href={s.url}
                      className="text-base text-foreground hover:text-accent transition-colors underline decoration-border hover:decoration-accent"
                    >
                      {s.title}
                    </a>
                    {s.published_at && (
                      <span className="text-sm text-muted tabular-nums shrink-0">
                        {formatPublishedAt(s.published_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-border">
          <Link href="/methodology" className="text-sm text-muted hover:text-foreground transition-colors">
            &larr; Back to methodology
          </Link>
        </div>
      </Container>
    </section>
  );
}
