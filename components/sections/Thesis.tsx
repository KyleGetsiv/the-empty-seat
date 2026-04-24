import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSiteContent } from "@/lib/site-content";
import { Container } from "@/components/ui/Container";

export async function Thesis() {
  const content = await getSiteContent("thesis_paragraphs");
  if (!content) return null;

  return (
    <section className="border-b border-border">
      <Container className="py-16 sm:py-24 max-w-2xl">
        <div className="prose prose-editorial font-sans text-base text-foreground leading-relaxed [&_p]:mb-5 [&_p:last-child]:mb-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.markdown_body}
          </ReactMarkdown>
        </div>
      </Container>
    </section>
  );
}
