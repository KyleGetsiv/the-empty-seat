// lib/supabase/browser.ts
//
// USE IN:  Client Components ('use client' files) only.
// DO NOT: import this in Server Components, Route Handlers, or middleware.
//         For server-side access use lib/supabase/server.ts.
//         For privileged server-side writes use lib/supabase/admin.ts.
//
// Returns a singleton so the same client instance is reused across re-renders.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseBrowserClient() {
  if (client) return client;

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}
