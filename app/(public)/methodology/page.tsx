import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { MarkdownBody } from "@/components/ui/MarkdownBody";

export const revalidate = 3600;

export default async function MethodologyPage() {
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("site_content")
    .select("markdown_body")
    .eq("key", "methodology_body")
    .maybeSingle();

  if (!row?.markdown_body) {
    throw new Error(
      "site_content row 'methodology_body' is missing. Run scripts/seed-methodology-content.ts."
    );
  }

  const content = row.markdown_body;

  return (
    <section>
      <Container className="py-24 sm:py-32 max-w-3xl">
        <Heading level={1}>Methodology</Heading>
        <div className="mt-8">
          <MarkdownBody content={content} />
        </div>

        {/* Section method lives with the section it defends, so the reader
            meets it where the data is. This block is the index. Static rather
            than part of methodology_body so a new section cannot ship with no
            route from here. (4.6a) */}
        <div className="mt-16 border-t border-border pt-8">
          <h2 className="text-xs uppercase tracking-wide font-medium text-muted">Method by section</h2>
          <dl className="mt-4 flex flex-col gap-4 text-sm">
            <div>
              <dt>
                <Link
                  href="/earnings#method"
                  className="text-accent underline hover:text-accent-hover transition-colors"
                >
                  How Alphabet quotes are produced
                </Link>
              </dt>
              <dd className="mt-1 text-muted leading-relaxed">
                How filings and call transcripts are ingested, how quotes are verified character by
                character against the stored document, and what a human approves before anything is
                published.
              </dd>
            </div>
            <div>
              <dt>
                <Link
                  href="/landscape#method"
                  className="text-accent underline hover:text-accent-hover transition-colors"
                >
                  How to read the landscape page
                </Link>
              </dt>
              <dd className="mt-1 text-muted leading-relaxed">
                The disclosure-quality taxonomy: what separates a regulatory filing from a company
                statement from an estimate, and why blank cells are left blank.
              </dd>
            </div>
            <div>
              <dt>
                <Link
                  href="/methodology/sources"
                  className="text-accent underline hover:text-accent-hover transition-colors"
                >
                  Every source, by publisher
                </Link>
              </dt>
              <dd className="mt-1 text-muted leading-relaxed">
                The full catalog of primary sources behind the figures on this site.
              </dd>
            </div>
          </dl>
        </div>
      </Container>
    </section>
  );
}
