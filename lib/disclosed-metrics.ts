import { createSupabaseServerClient } from "./supabase/server";

export interface DisclosedWeeklyRides {
  value: number;
  as_of: Date;
  source: {
    id: string;
    url: string;
    publisher: string;
    title: string;
    published_at: Date | null;
  };
}

function parseDisclosedRow(
  body: string
): { value: number; as_of: string; source_id: string } | null {
  const parsed: Record<string, string> = {};
  for (const line of body.trim().split(/\r?\n/)) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) parsed[match[1].trim()] = match[2].trim();
  }

  const { value, as_of, source_id } = parsed;
  if (!value || !as_of || !source_id) return null;

  const numValue = parseInt(value, 10);
  if (isNaN(numValue) || numValue <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(as_of)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source_id))
    return null;

  return { value: numValue, as_of, source_id };
}

/**
 * Reads the latest_weekly_rides_disclosed row from site_content, parses it,
 * and joins to sources. Returns null if the row is absent or malformed, or if
 * the referenced source no longer exists. Falls back gracefully: callers should
 * display the CPUC-derived value when this returns null.
 */
export async function getLatestDisclosedWeeklyRides(): Promise<DisclosedWeeklyRides | null> {
  const supabase = await createSupabaseServerClient();

  const { data: contentRow } = await supabase
    .from("site_content")
    .select("markdown_body")
    .eq("key", "latest_weekly_rides_disclosed")
    .single();

  if (!contentRow) return null;

  const parsed = parseDisclosedRow(contentRow.markdown_body);
  if (!parsed) {
    console.warn(
      "[disclosed-metrics] latest_weekly_rides_disclosed: failed to parse markdown_body"
    );
    return null;
  }

  const { data: sourceRow } = await supabase
    .from("sources")
    .select("id, url, publisher, title, published_at")
    .eq("id", parsed.source_id)
    .single();

  if (!sourceRow) {
    console.warn(
      `[disclosed-metrics] source_id ${parsed.source_id} not found in sources table`
    );
    return null;
  }

  return {
    value: parsed.value,
    as_of: new Date(parsed.as_of + "T00:00:00Z"),
    source: {
      id: sourceRow.id,
      url: sourceRow.url,
      publisher: sourceRow.publisher,
      title: sourceRow.title,
      published_at: sourceRow.published_at ? new Date(sourceRow.published_at) : null,
    },
  };
}
