// lib/supabase/server.ts
//
// USE IN:  Server Components, Route Handlers, Server Actions, middleware.
// DO NOT: import this in Client Components ('use client' files).
//         For client components use lib/supabase/browser.ts instead.
//         For privileged server-side writes use lib/supabase/admin.ts.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component; session refresh is
            // handled by middleware so this is safe to ignore.
          }
        },
      },
    }
  );
}
