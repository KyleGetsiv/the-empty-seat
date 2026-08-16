// lib/earnings-review.ts
//
// Server-side queries behind the earnings review queue (module 4.5). Imports
// supabaseAdmin, so it is never imported by a "use client" file: the client
// components read the mention vocabulary from lib/earnings-mentions.ts
// instead.

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface MentionCounts {
  pending: number;
  approved: number;
  rejected: number;
}

export const EMPTY_COUNTS: MentionCounts = { pending: 0, approved: 0, rejected: 0 };

// One query for every mention's status, keyed by event. The table holds a few
// hundred rows across 33 events, so counting in memory beats a count query
// per event; revisit if the corpus grows past a few thousand mentions.
export async function getMentionCountsByEvent(): Promise<Map<string, MentionCounts>> {
  const { data } = await supabaseAdmin.from("waymo_mentions").select("earnings_event_id, review_status");
  const counts = new Map<string, MentionCounts>();
  for (const m of data ?? []) {
    const c = counts.get(m.earnings_event_id) ?? { ...EMPTY_COUNTS };
    const status = m.review_status as keyof MentionCounts;
    if (status in c) c[status]++;
    counts.set(m.earnings_event_id, c);
  }
  return counts;
}

// The next event with unreviewed mentions, oldest first, so a review session
// walks the corpus in the order the disclosures happened. `excludeId` skips
// the event just finished (its counts may not have settled in this render).
export async function getNextUnreviewedEventId(excludeId?: string): Promise<string | null> {
  const { data: pending } = await supabaseAdmin
    .from("waymo_mentions")
    .select("earnings_event_id")
    .eq("review_status", "pending");
  const ids = [...new Set((pending ?? []).map((m) => m.earnings_event_id))].filter((id) => id !== excludeId);
  if (ids.length === 0) return null;
  const { data: events } = await supabaseAdmin
    .from("earnings_events")
    .select("id")
    .in("id", ids)
    .order("event_date", { ascending: true })
    .limit(1);
  return events?.[0]?.id ?? null;
}
