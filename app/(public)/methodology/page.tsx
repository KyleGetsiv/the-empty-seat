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
      </Container>
    </section>
  );
}
