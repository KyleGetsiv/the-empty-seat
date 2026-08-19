// lib/earnings-promote.ts
//
// Metric promotion: turning an approved metric-type mention into a
// disclosed_metrics row. Extracted from the review page in fix(4.5) so the
// decision logic can be tested offline, and so the restatement rule below
// lives in one place rather than inside a server action.
//
// The rule that motivated the extraction: a figure reaffirmed on a later
// earnings call is NOT a new disclosure. Promotion previously hardcoded
// as_of to the event date and upserted on (company_id, metric, as_of), so
// Pichai repeating "500,000 rides a week" on the Q1 2026 call filed a second
// 500,000 row a month after the original. That produced three duplicate
// weekly_rides pairs and flat doubled steps on the public DisclosedRidesChart.
// A figure now gets one row, dated to the earliest statement of it, with each
// reaffirmation appended to that row's notes.

import type { Database } from "@/lib/supabase/types";
import { METRIC_PROMOTION } from "@/lib/earnings-mentions";

// The event fields promotion needs, passed explicitly rather than captured
// from the page's event row so a server action's closure stays serializable.
export interface PromotionContext {
  subjectId: string;
  eventDate: string;
  eventType: string;
  fiscalPeriod: string;
  sourceId: string | null;
}

// A disclosed_metrics row as far as promotion cares about it.
export interface CandidateRow {
  id: string;
  as_of: string;
  scope: string | null;
  notes: string | null;
}

export type PromotionDecision =
  // Not a promoting mention type, no context, or no usable number.
  | { kind: "none" }
  // No existing row holds this figure: insert one dated to this event.
  | { kind: "insert" }
  // This figure already exists. Link the mention to it. When redateTo is set,
  // this event predates the existing row, so the row is moved back to the
  // earlier date: the arc should show a figure at the moment it was FIRST
  // said, not whichever event happened to be processed first.
  | { kind: "link"; rowId: string; redateTo?: string };

export const PROMOTION_SCOPE = "worldwide";

// Human-readable provenance for a reaffirmation. Deliberately free of ids:
// disclosed_metrics.notes can surface in the public <Metric> tooltip, and the
// pre-fix version wrote a raw mention UUID into it.
export function reaffirmationNote(ctx: PromotionContext): string {
  return `Reaffirmed in the ${ctx.eventType.replace(/_/g, " ")} for ${ctx.fiscalPeriod} (${ctx.eventDate}).`;
}

export function firstDisclosureNote(ctx: PromotionContext): string {
  return `Promoted from the ${ctx.eventType.replace(/_/g, " ")} for ${ctx.fiscalPeriod}.`;
}

// Idempotent: re-approving the same mention must not append the same sentence
// twice, and re-running the backfill must not grow notes without bound.
export function appendReaffirmation(notes: string | null, ctx: PromotionContext): string {
  const line = reaffirmationNote(ctx);
  const base = (notes ?? "").trim();
  if (!base) return line;
  if (base.includes(line)) return base;
  return `${base} ${line}`;
}

// A candidate is the same figure only if it is the same scope. A hand-seeded
// row that never set scope is treated as matching, because the 2.3 seed rows
// are the originals the earnings pipeline should be linking to.
export function isSameScope(row: CandidateRow): boolean {
  return row.scope === null || row.scope === PROMOTION_SCOPE;
}

// Pure decision step. Callers hand it every disclosed_metrics row already
// holding this (company, metric, value); it decides link vs insert. Kept
// separate from the database work so the three promotion paths are testable
// without a Supabase fake.
export function decidePromotion(
  candidates: CandidateRow[],
  ctx: PromotionContext | null,
  mentionType: string,
  value: number
): PromotionDecision {
  const slug = METRIC_PROMOTION[mentionType];
  if (!slug || !ctx || !Number.isFinite(value) || value <= 0) return { kind: "none" };

  const matches = candidates.filter(isSameScope).sort((a, b) => a.as_of.localeCompare(b.as_of));
  if (matches.length === 0) return { kind: "insert" };

  const earliest = matches[0];
  if (earliest.as_of <= ctx.eventDate) return { kind: "link", rowId: earliest.id };
  // Every existing row postdates this event, so this event is the earlier
  // statement and the row should carry its date.
  return { kind: "link", rowId: earliest.id, redateTo: ctx.eventDate };
}

export function metricSlugFor(mentionType: string): string | undefined {
  return METRIC_PROMOTION[mentionType];
}

type DisclosedMetricsInsert = Database["public"]["Tables"]["disclosed_metrics"]["Insert"];
type DisclosedMetricsUpdate = Database["public"]["Tables"]["disclosed_metrics"]["Update"];

export function insertPayload(
  ctx: PromotionContext,
  slug: string,
  value: number
): DisclosedMetricsInsert {
  return {
    company_id: ctx.subjectId,
    metric: slug,
    value,
    as_of: ctx.eventDate,
    scope: PROMOTION_SCOPE,
    attribution: "company",
    source_id: ctx.sourceId,
    stated_by: `${ctx.eventType.replace(/_/g, " ")}, ${ctx.fiscalPeriod}`,
    notes: firstDisclosureNote(ctx),
  } as DisclosedMetricsInsert;
}

// --- database side -------------------------------------------------------
// Thin: it fetches the candidate rows, defers to decidePromotion above, and
// executes. All of the judgement is in the pure function.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminClient = SupabaseClient<Database>;

export interface PromotionResult {
  id: string | null;
  linked: boolean;
}

export async function promoteMetric(
  db: AdminClient,
  ctx: PromotionContext | null,
  mentionType: string,
  value: number
): Promise<PromotionResult> {
  const slug = metricSlugFor(mentionType);
  if (!slug || !ctx || !Number.isFinite(value) || value <= 0) return { id: null, linked: false };

  const { data: candidates, error: readError } = await db
    .from("disclosed_metrics")
    .select("id, as_of, scope, notes")
    .eq("company_id", ctx.subjectId)
    .eq("metric", slug)
    .eq("value", value);
  if (readError) {
    console.error("[promote disclosed_metric: read]", readError);
    throw new Error(`Failed to check for an existing disclosure: ${readError.message}`);
  }

  const decision = decidePromotion((candidates ?? []) as CandidateRow[], ctx, mentionType, value);
  if (decision.kind === "none") return { id: null, linked: false };

  if (decision.kind === "link") {
    const existing = (candidates ?? []).find((c) => c.id === decision.rowId) as CandidateRow | undefined;
    const notes = appendReaffirmation(existing?.notes ?? null, ctx);
    const patch: DisclosedMetricsUpdate = { notes };
    // Re-dating can collide with the unique (company_id, metric, as_of) index
    // if a different figure already sits on that date. The link is the point;
    // the date is a refinement, so a collision degrades to linking as-is
    // rather than failing the reviewer's approve.
    if (decision.redateTo) patch.as_of = decision.redateTo;
    const { error: updateError } = await db.from("disclosed_metrics").update(patch).eq("id", decision.rowId);
    if (updateError && decision.redateTo) {
      const { error: retryError } = await db
        .from("disclosed_metrics")
        .update({ notes })
        .eq("id", decision.rowId);
      if (retryError) {
        console.error("[promote disclosed_metric: link]", retryError);
        throw new Error(`Failed to link to the existing disclosure: ${retryError.message}`);
      }
      console.warn(
        `[promote disclosed_metric] kept as_of on ${decision.rowId}: re-dating to ${decision.redateTo} collided with an existing row.`
      );
    } else if (updateError) {
      console.error("[promote disclosed_metric: link]", updateError);
      throw new Error(`Failed to link to the existing disclosure: ${updateError.message}`);
    }
    return { id: decision.rowId, linked: true };
  }

  const { data: inserted, error: insertError } = await db
    .from("disclosed_metrics")
    .upsert(insertPayload(ctx, slug, value), { onConflict: "company_id,metric,as_of" })
    .select("id")
    .single();
  if (insertError) {
    console.error("[promote disclosed_metric: insert]", insertError);
    throw new Error(`Failed to promote metric: ${insertError.message}`);
  }
  return { id: inserted.id, linked: false };
}

// Withdraws a promotion when a mention stops being a metric mention (its type
// was edited away from a promoting type, or it was rejected). The row itself
// is deleted only when no other approved mention still cites it, so a figure
// reaffirmed across several events survives losing one of its citations.
// This is the gap that left cities_count 11 @ 2026-04-29 orphaned.
export async function withdrawPromotion(db: AdminClient, mentionId: string, disclosedMetricId: string | null) {
  if (!disclosedMetricId) return;
  const { error: unlinkError } = await db
    .from("waymo_mentions")
    .update({ disclosed_metric_id: null })
    .eq("id", mentionId);
  if (unlinkError) throw new Error(`Failed to unlink the promoted metric: ${unlinkError.message}`);

  const { count, error: countError } = await db
    .from("waymo_mentions")
    .select("id", { count: "exact", head: true })
    .eq("disclosed_metric_id", disclosedMetricId)
    .eq("review_status", "approved");
  if (countError) throw new Error(`Failed to count remaining citations: ${countError.message}`);
  if ((count ?? 0) > 0) return;

  const { error: deleteError } = await db.from("disclosed_metrics").delete().eq("id", disclosedMetricId);
  if (deleteError) throw new Error(`Failed to remove the orphaned disclosure: ${deleteError.message}`);
}
