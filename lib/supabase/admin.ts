// lib/supabase/admin.ts
//
// USE IN:  Server-only contexts: scraper jobs, admin Route Handlers,
//          background scripts. Bypasses RLS entirely.
// DO NOT: import this in Client Components, or in any file that might be
//         bundled for the browser. The service role key must never be
//         exposed to the client.
//
// The `server-only` import below causes a build error if this module is
// accidentally imported from a Client Component.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
