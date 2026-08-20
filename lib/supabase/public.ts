// lib/supabase/public.ts
//
// USE IN:  public pages that render the same bytes for everyone (ISR).
// DO NOT:  use for anything session-dependent; there is no session here.
//
// The anon client with no cookie handling. server.ts reads cookies, which
// means an admin browsing a public page is authenticated against RLS and can
// see rows the public cannot: drafts, and (module 4.6a) unapproved LLM
// output. On /earnings that is not cosmetic. The page's entire argument is
// that nothing is public until a human approved it, so it must render as the
// public sees it no matter who is looking. Reading cookies also opts a route
// out of static rendering.
//
// Adopted in 4.6a for the earnings routes. The older public pages still use
// createSupabaseServerClient(); moving them is tracked in architecture.md.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createSupabasePublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
