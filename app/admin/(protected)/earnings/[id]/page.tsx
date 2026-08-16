import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import type { Database } from "@/lib/supabase/types";
import { PRICE_USD_PER_MTOK_IN, PRICE_USD_PER_MTOK_OUT } from "@/lib/extraction/schema";
import { readDropLog } from "@/lib/extraction/drop-log";
import { METRIC_PROMOTION, REVIEW_STATUSES } from "@/lib/earnings-mentions";
import { getNextUnreviewedEventId } from "@/lib/earnings-review";
import { MentionCard, type MentionCardData } from "@/components/admin/MentionCard";

type ExtractedMetric = { metric?: string; value?: number; unit?: string; period?: string } | null;
type MentionRow = Database["public"]["Tables"]["waymo_mentions"]["Row"];

const DROP_REASON_LABEL: Record<string, string> = {
  invalid_schema: "failed schema validation",
  unverified: "not found verbatim in the source",
};

// The three helpers below live at module scope on purpose. A server action's
// closure is serialized, and a function captured in it cannot be, so a helper
// defined inside the component and called from an action fails at render with
// "Functions cannot be passed directly to Client Components". Marking them
// "use server" would fix that by publishing each as its own endpoint, which is
// worse: promoteMetric would become a public "write any disclosed_metrics row"
// call. At module scope they are ordinary imports, and the actions capture
// only strings.

// The event fields metric promotion needs, passed explicitly rather than
// captured from the page's event row.
interface PromotionContext {
  subjectId: string;
  eventDate: string;
  eventType: string;
  fiscalPeriod: string;
  sourceId: string | null;
}

// Promotes an approved metric mention to a disclosed_metrics row and returns
// the row id to link back from the mention. Shared by the single-mention and
// bulk paths so a bulk approve cannot quietly skip promotion.
async function promoteMetric(
  ctx: PromotionContext | null,
  mentionId: string,
  mentionType: string,
  value: number
): Promise<string | null> {
  const slug = METRIC_PROMOTION[mentionType];
  if (!slug || !ctx || !Number.isFinite(value) || value <= 0) return null;
  const { data: dm, error } = await supabaseAdmin
    .from("disclosed_metrics")
    .upsert(
      {
        company_id: ctx.subjectId,
        metric: slug,
        value,
        as_of: ctx.eventDate,
        scope: "worldwide",
        attribution: "company",
        source_id: ctx.sourceId,
        stated_by: `${ctx.eventType.replace(/_/g, " ")}, ${ctx.fiscalPeriod}`,
        notes: `Promoted from earnings extraction; mention ${mentionId}.`,
      },
      { onConflict: "company_id,metric,as_of" }
    )
    .select("id")
    .single();
  if (error) {
    console.error("[promote disclosed_metric]", error);
    throw new Error(`Failed to promote metric: ${error.message}`);
  }
  return dm.id;
}

// Flips the event to 'reviewed' once nothing is pending on it.
async function settleEventStatus(eventId: string) {
  const { count } = await supabaseAdmin
    .from("waymo_mentions")
    .select("id", { count: "exact", head: true })
    .eq("earnings_event_id", eventId)
    .eq("review_status", "pending");
  if ((count ?? 0) === 0) {
    await supabaseAdmin.from("earnings_events").update({ processing_status: "reviewed" }).eq("id", eventId);
  }
}

function revalidateAll(eventId: string) {
  revalidatePath("/");
  revalidatePath("/earnings");
  revalidatePath(`/admin/earnings/${eventId}`);
  revalidatePath("/admin/earnings");
}

export default async function ReviewEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; reprocess?: string }>;
}) {
  const { id } = await params;
  const { status: statusFilter = "", reprocess = "" } = await searchParams;

  const [{ data: event }, { data: mentions }] = await Promise.all([
    supabaseAdmin
      .from("earnings_events")
      .select("*, source:sources(url, title), subject:companies!earnings_events_subject_company_id_fkey(id, display_name)")
      .eq("id", id)
      .single(),
    supabaseAdmin
      .from("waymo_mentions")
      .select("*")
      .eq("earnings_event_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!event) notFound();

  const subject = event.subject as unknown as { id: string; display_name: string } | null;
  const src = event.source as unknown as { url: string; title: string } | null;

  const [dropLog, nextUnreviewedId] = await Promise.all([
    readDropLog(supabaseAdmin, id, event.extraction_version),
    getNextUnreviewedEventId(id),
  ]);

  // Only primitives cross into the server actions below, so their closures
  // stay serializable.
  const promotionContext: PromotionContext | null = subject
    ? {
        subjectId: subject.id,
        eventDate: event.event_date,
        eventType: event.event_type,
        fiscalPeriod: event.fiscal_period,
        sourceId: event.source_id,
      }
    : null;

  async function updateMention(formData: FormData) {
    "use server";
    const mentionId = formData.get("mention_id") as string;
    const action = formData.get("action") as string; // approve | reject | save
    const mentionType = formData.get("mention_type") as string;
    const annotation = (formData.get("kyle_annotation") as string) || null;
    const metricValueRaw = formData.get("metric_value") as string | null;

    const patch: Database["public"]["Tables"]["waymo_mentions"]["Update"] = {
      mention_type: mentionType,
      kyle_annotation: annotation,
    };
    if (action === "approve") patch.review_status = "approved";
    if (action === "reject") patch.review_status = "rejected";

    // On approve of a metric-type mention with a numeric value: promote to
    // disclosed_metrics (attribution company) and link back. The needs-a-number
    // guard in MentionCard is what keeps a metric mention from being approved
    // with no value by accident; approving one deliberately lands here with an
    // empty value and simply promotes nothing.
    if (action === "approve" && METRIC_PROMOTION[mentionType] && metricValueRaw) {
      const value = Number(metricValueRaw);
      const dmId = await promoteMetric(promotionContext, mentionId, mentionType, value);
      if (dmId) {
        patch.disclosed_metric_id = dmId;
        patch.extracted_metric = {
          metric: METRIC_PROMOTION[mentionType],
          value,
          unit: null,
          period: promotionContext?.fiscalPeriod ?? null,
        };
      }
    }

    const { error } = await supabaseAdmin.from("waymo_mentions").update(patch).eq("id", mentionId);
    if (error) {
      console.error("[update waymo_mentions]", error);
      throw new Error(`Failed to update waymo_mentions row: ${error.message}`);
    }

    await settleEventStatus(id);
    revalidateAll(id);
  }

  async function bulkApprove() {
    "use server";
    const { data: pendingRows, error: readError } = await supabaseAdmin
      .from("waymo_mentions")
      .select("id, mention_type, extracted_metric")
      .eq("earnings_event_id", id)
      .eq("review_status", "pending");
    if (readError) throw new Error(`Bulk approve failed: ${readError.message}`);

    for (const m of pendingRows ?? []) {
      const em = m.extracted_metric as ExtractedMetric;
      const value = em?.value;
      // A metric mention with no number needs a decision, so bulk approve
      // leaves it pending rather than approving something that can never
      // promote. The button copy says how many are being left behind.
      if (METRIC_PROMOTION[m.mention_type] && !(typeof value === "number" && value > 0)) continue;

      const patch: Database["public"]["Tables"]["waymo_mentions"]["Update"] = { review_status: "approved" };
      if (METRIC_PROMOTION[m.mention_type] && typeof value === "number") {
        const dmId = await promoteMetric(promotionContext, m.id, m.mention_type, value);
        if (dmId) patch.disclosed_metric_id = dmId;
      }
      const { error } = await supabaseAdmin.from("waymo_mentions").update(patch).eq("id", m.id);
      if (error) throw new Error(`Bulk approve failed: ${error.message}`);
    }

    await settleEventStatus(id);
    revalidateAll(id);
  }

  // Reprocess runs the model again, so it is dispatched to the GitHub Action
  // that already owns extraction (extract-earnings.yml) rather than run inside
  // a Vercel function: a 10-K can need a dozen model calls, past the function
  // duration limit. The run replaces only pending mentions; approved and
  // rejected ones are human decisions and survive.
  async function reprocessEvent() {
    "use server";
    const token = process.env.GITHUB_DISPATCH_TOKEN;
    const repo = process.env.GITHUB_REPO ?? "KyleGetsiv/the-empty-seat";
    const ref = process.env.GITHUB_DISPATCH_REF ?? "main";
    if (!token) throw new Error("GITHUB_DISPATCH_TOKEN is not set; cannot dispatch the extraction workflow.");

    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/extract-earnings.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref, inputs: { event: id } }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Workflow dispatch failed (${res.status}): ${body.slice(0, 200)}`);
    }
    redirect(`/admin/earnings/${id}?reprocess=queued`);
  }

  const all = mentions ?? [];
  const pending = all.filter((m) => m.review_status === "pending");
  const pendingNeedingNumber = pending.filter((m) => {
    const em = m.extracted_metric as ExtractedMetric;
    return METRIC_PROMOTION[m.mention_type] && !(typeof em?.value === "number" && em.value > 0);
  }).length;
  const bulkApprovable = pending.length - pendingNeedingNumber;

  const visible = statusFilter ? all.filter((m) => m.review_status === statusFilter) : all;
  const statusCount = (s: string) => all.filter((m) => m.review_status === s).length;

  const filterHref = (s: string) => `/admin/earnings/${id}${s ? `?status=${s}` : ""}`;
  const filterClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`;

  const canReprocess = Boolean(process.env.GITHUB_DISPATCH_TOKEN);
  const hasDropCount = (event.mentions_dropped ?? 0) > 0;

  const toCardData = (m: MentionRow): MentionCardData => {
    const em = m.extracted_metric as ExtractedMetric;
    return {
      id: m.id,
      quote_text: m.quote_text,
      speaker: m.speaker,
      page_or_timestamp: m.page_or_timestamp,
      confidence: m.confidence,
      review_status: m.review_status,
      mention_type: m.mention_type,
      kyle_annotation: m.kyle_annotation,
      disclosed_metric_id: m.disclosed_metric_id,
      metric_value: typeof em?.value === "number" ? em.value : null,
      metric_label:
        em?.value != null ? `${em.metric ?? ""} ${em.value} ${em.unit ?? ""} ${em.period ?? ""}`.replace(/\s+/g, " ").trim() : null,
    };
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/earnings" className="text-sm text-gray-500 hover:text-gray-700">Earnings Events</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">{event.fiscal_period} {event.event_type}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-2">
        {event.event_date} | {event.processing_status}
        {event.extraction_model ? ` | ${event.extraction_model} v${event.extraction_version}` : ""}
        {src ? (
          <> | <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{src.title}</a></>
        ) : null}
        {event.storage_key ? (
          <> | <Link href={`/admin/earnings/${id}/source`} className="text-blue-600 hover:underline">stored source</Link></>
        ) : null}
        {event.error ? <span className="text-red-600"> | {event.error}</span> : null}
      </p>
      {event.processing_status !== "pending" && event.extraction_chunks !== null && (
        <p className="text-xs text-gray-400 mb-4">
          Extraction read {event.extraction_chunks} chunk(s), {(event.extraction_input_tokens ?? 0).toLocaleString()} in / {(event.extraction_output_tokens ?? 0).toLocaleString()} out tokens
          {" "}(~${(((event.extraction_input_tokens ?? 0) * PRICE_USD_PER_MTOK_IN + (event.extraction_output_tokens ?? 0) * PRICE_USD_PER_MTOK_OUT) / 1_000_000).toFixed(2)} est.)
          {hasDropCount ? `; ${event.mentions_dropped} model quote(s) dropped` : ""}
          {event.extraction_chunks === 0 ? "; document contains no Waymo or Other Bets passages" : ""}
        </p>
      )}

      {reprocess === "queued" && (
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Extraction queued on GitHub Actions for this event. It replaces pending mentions only; approved and
          rejected ones stay. Reload in a minute or two, or watch the run in the Actions tab.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={filterHref("")} className={filterClass(!statusFilter)}>All {all.length}</Link>
        {REVIEW_STATUSES.map((s) => (
          <Link key={s} href={filterHref(s)} className={filterClass(statusFilter === s)}>
            {s} {statusCount(s)}
          </Link>
        ))}
        <span className="flex-1" />
        <form action={reprocessEvent}>
          <button
            type="submit"
            disabled={!canReprocess}
            title={canReprocess ? "Dispatch extract-earnings.yml for this event" : "Set GITHUB_DISPATCH_TOKEN to enable"}
            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            Reprocess
          </button>
        </form>
      </div>

      {bulkApprovable > 1 && (
        <form action={bulkApprove} className="mb-6">
          <button type="submit" className="rounded border border-green-600 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50">
            Approve all {bulkApprovable} pending
            {pendingNeedingNumber > 0 ? ` (leaving ${pendingNeedingNumber} that need a number)` : ""}
          </button>
        </form>
      )}

      {all.length === 0 && (
        <p className="text-gray-400 text-sm">No mentions extracted for this event yet.</p>
      )}
      {all.length > 0 && visible.length === 0 && (
        <p className="text-gray-400 text-sm">No {statusFilter} mentions on this event.</p>
      )}

      <div className="flex flex-col gap-4">
        {visible.map((m) => (
          <MentionCard
            key={m.id}
            mention={toCardData(m)}
            action={updateMention}
            sourceHref={
              event!.storage_key && m.page_or_timestamp
                ? `/admin/earnings/${id}/source?p=${encodeURIComponent(m.page_or_timestamp)}#${encodeURIComponent(m.page_or_timestamp)}`
                : null
            }
          />
        ))}
      </div>

      <details className="mt-8 rounded-lg border border-gray-200 bg-white p-4" open={Boolean(dropLog?.dropped.length)}>
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Dropped quotes
          {dropLog ? ` (${dropLog.dropped.length})` : hasDropCount ? ` (${event.mentions_dropped} counted, no log)` : " (none)"}
        </summary>
        <div className="mt-3 text-sm">
          {!dropLog && hasDropCount && (
            <p className="text-gray-500">
              This event was extracted before the drop log existed, so only the count survives: the
              {" "}{event.mentions_dropped} discarded quotes themselves were never stored. Reprocess the event to
              produce a log. The model is not deterministic, so a re-run may drop a different set.
            </p>
          )}
          {!dropLog && !hasDropCount && (
            <p className="text-gray-500">
              No drop log for this extraction. Events processed from module 4.5 onward always write one, even when
              nothing was dropped.
            </p>
          )}
          {dropLog && dropLog.dropped.length === 0 && (
            <p className="text-gray-500">
              Nothing dropped. Every quote the model returned validated and was found verbatim in the source
              ({dropLog.mentions_kept} kept, {dropLog.duplicates_removed} duplicate(s) removed).
            </p>
          )}
          {dropLog && dropLog.dropped.length > 0 && (
            <>
              <p className="text-gray-500 mb-3">
                Quotes the model returned that were not stored. These are model output, not source text: an
                unverified quote is by definition text that does not appear in the document.
              </p>
              <ul className="flex flex-col gap-3">
                {dropLog.dropped.map((d, i) => (
                  <li key={i} className="rounded border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs text-gray-500 mb-1">
                      chunk {d.chunk} | cited {d.locator ?? "nothing"} | {d.mention_type ?? "no type"} |{" "}
                      <span className={d.reason === "unverified" ? "text-red-600" : "text-amber-700"}>
                        {DROP_REASON_LABEL[d.reason] ?? d.reason}
                      </span>
                    </div>
                    <blockquote className="text-sm text-gray-700 border-l-2 border-gray-300 pl-3">
                      {d.quote_text || <span className="text-gray-400">(no quote text returned)</span>}
                    </blockquote>
                    {d.detail && <p className="mt-1 text-xs text-gray-400">{d.detail}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </details>

      <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-4">
        <Link href="/admin/earnings" className="text-sm text-gray-500 hover:text-gray-700">Back to all events</Link>
        {nextUnreviewedId ? (
          <Link
            href={`/admin/earnings/${nextUnreviewedId}`}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Next unreviewed event
          </Link>
        ) : (
          <span className="text-sm text-gray-400">Nothing else is awaiting review.</span>
        )}
      </div>
    </div>
  );
}
