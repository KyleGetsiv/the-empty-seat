import { createSupabaseServerClient } from "./supabase/server";

export interface SiteContentRow {
  markdown_body: string;
  updated_at: string;
}

export async function getSiteContent(
  key: string
): Promise<SiteContentRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_content")
    .select("markdown_body, updated_at")
    .eq("key", key)
    .single();

  if (error) {
    console.warn(`[site-content] key="${key}" not found:`, error.message);
    return null;
  }
  return data;
}
