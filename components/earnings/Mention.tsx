// components/earnings/Mention.tsx
//
// Picks the right presentation for a mention (4.6a fix). A quote that is
// really a row lifted from a financial table is not a quotation and is not
// rendered as one; see components/earnings/TableReading.tsx.

import { isTableReading } from "@/lib/earnings-table";
import { MentionQuote } from "./MentionQuote";
import { TableReading } from "./TableReading";
import type { PublicMention } from "@/lib/earnings-types";

export function Mention({ mention, compact = false }: { mention: PublicMention; compact?: boolean }) {
  return isTableReading(mention.quoteText) ? (
    <TableReading mention={mention} compact={compact} />
  ) : (
    <MentionQuote mention={mention} compact={compact} />
  );
}
