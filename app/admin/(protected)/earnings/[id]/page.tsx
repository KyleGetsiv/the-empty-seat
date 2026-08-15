import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import type { Database } from "@/lib/supabase/types";
import { PRICE_USD_PER_MTOK_IN, PRICE_USD_PER_MTOK_OUT } from "@/lib/extraction/schema";

const MENTION_TYPES = [
  "revenue_reference", "city_count", "ride_count", "fleet_size", "capex", "operating_loss",
  "strategic_commentary", "forward_guidance", "competitive_reference", "safety_reference", "other",
];

// Metric mention types that promote to disclosed_metrics on approval, and
// the disclosed_metrics.metric slug each maps to.
const METRIC_PROMOTION: Record<string, string> = {
  ride_count: "weekly_rides",
  city_count: "cities_count",
  fleet_size: "fleet_size",
};

type ExtractedMetric = { metric?: string; value?: number; unit?: string; period?: string } | null;

export default async function ReviewEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    // disclosed_metrics (attribution company) and link back.
    if (action === "approve" && METRIC_PROMOTION[mentionType] && metricValueRaw && subject) {
      const value = Number(metricValueRaw);
      if (!Number.isNaN(value) && value > 0) {
        const { data: dm, error: dmError } = await supabaseAdmin
          .from("disclosed_metrics")
          .upsert(
            {
              company_id: subject.id,
              metric: METRIC_PROMOTION[mentionType],
              value,
              as_of: event!.event_date,
              scope: "worldwide",
              attribution: "company",
              source_id: event!.source_id,
              stated_by: `${event!.event_type.replace(/_/g, " ")}, ${event!.fiscal_period}`,
              notes: `Promoted from earnings extraction; mention ${mentionId}.`,
            },
            { onConflict: "company_id,metric,as_of" }
          )
          .select("id")
          .single();
        if (dmError) {
          console.error("[promote disclosed_metric]", dmError);
          throw new Error(`Failed to promote metric: ${dmError.message}`);
        }
        patch.disclosed_metric_id = dm.id;
        patch.extracted_metric = { metric: METRIC_PROMOTION[mentionType], value, unit: null, period: event!.fiscal_period };
      }
    }

    const { error } = await supabaseAdmin.from("waymo_mentions").update(patch).eq("id", mentionId);
    if (error) {
      console.error("[update waymo_mentions]", error);
      throw new Error(`Failed to update waymo_mentions row: ${error.message}`);
    }

    // If no pending mentions remain, mark the event reviewed.
    const { count } = await supabaseAdmin
      .from("waymo_mentions")
      .select("id", { count: "exact", head: true })
      .eq("earnings_event_id", id)
      .eq("review_status", "pending");
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("earnings_events").update({ processing_status: "reviewed" }).eq("id", id);
    }
    revalidatePath("/");
    revalidatePath("/earnings");
    revalidatePath(`/admin/earnings/${id}`);
  }

  async function bulkApprove() {
    "use server";
    const { error } = await supabaseAdmin
      .from("waymo_mentions")
      .update({ review_status: "approved" })
      .eq("earnings_event_id", id)
      .eq("review_status", "pending");
    if (error) throw new Error(`Bulk approve failed: ${error.message}`);
    await supabaseAdmin.from("earnings_events").update({ processing_status: "reviewed" }).eq("id", id);
    revalidatePath("/");
    revalidatePath("/earnings");
    revalidatePath(`/admin/earnings/${id}`);
  }

  const pending = (mentions ?? []).filter((m) => m.review_status === "pending");

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/earnings" className="text-sm text-gray-500 hover:text-gray-700">Earnings Events</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-semibold text-gray-900">{event.fiscal_period} {event.event_type}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {event.event_date} | {event.processing_status}
        {event.extraction_model ? ` | ${event.extraction_model} v${event.extraction_version}` : ""}
        {src ? (
          <> | <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{src.title}</a></>
        ) : null}
        {event.error ? <span className="text-red-600"> | {event.error}</span> : null}
      </p>
      {event.processing_status !== "pending" && event.extraction_chunks !== null && (
        <p className="text-xs text-gray-400 -mt-4 mb-6">
          Extraction read {event.extraction_chunks} chunk(s), {(event.extraction_input_tokens ?? 0).toLocaleString()} in / {(event.extraction_output_tokens ?? 0).toLocaleString()} out tokens
          {" "}(~${(((event.extraction_input_tokens ?? 0) * PRICE_USD_PER_MTOK_IN + (event.extraction_output_tokens ?? 0) * PRICE_USD_PER_MTOK_OUT) / 1_000_000).toFixed(2)} est.)
          {event.mentions_dropped ? `; ${event.mentions_dropped} model quote(s) dropped for failing verbatim verification` : ""}
          {event.extraction_chunks === 0 ? "; document contains no Waymo or Other Bets passages" : ""}
        </p>
      )}

      {pending.length > 1 && (
        <form action={bulkApprove} className="mb-6">
          <button type="submit" className="rounded border border-green-600 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50">
            Approve all {pending.length} pending (non-metric only promotes nothing)
          </button>
        </form>
      )}

      {(mentions ?? []).length === 0 && (
        <p className="text-gray-400 text-sm">No mentions extracted for this event yet.</p>
      )}

      <div className="flex flex-col gap-4">
        {mentions?.map((m) => {
          const em = m.extracted_metric as ExtractedMetric;
          const isMetricType = !!METRIC_PROMOTION[m.mention_type];
          return (
            <form
              key={m.id}
              action={updateMention}
              className={`rounded-lg border bg-white p-5 ${
                m.review_status === "approved" ? "border-green-200" : m.review_status === "rejected" ? "border-gray-200 opacity-60" : "border-amber-200"
              }`}
            >
              <input type="hidden" name="mention_id" value={m.id} />
              <div className="flex items-start justify-between gap-4 mb-3">
                <blockquote className="text-sm text-gray-900 leading-relaxed border-l-2 border-gray-300 pl-3">
                  {m.quote_text}
                </blockquote>
                <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
                  {m.review_status} | {m.confidence}
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-3">
                {m.speaker ? `${m.speaker}` : "filing text"}
                {m.page_or_timestamp ? ` | ${m.page_or_timestamp}` : ""}
                {em?.value != null ? ` | extracted: ${em.metric ?? ""} ${em.value} ${em.unit ?? ""} ${em.period ?? ""}` : ""}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select name="mention_type" defaultValue={m.mention_type} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                    {MENTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Metric value {isMetricType ? "(promotes to disclosed_metrics on approve)" : ""}
                  </label>
                  <input name="metric_value" type="number" step="any" defaultValue={em?.value ?? ""} placeholder={isMetricType ? "e.g. 500000" : ""} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Annotation</label>
                  <input name="kyle_annotation" defaultValue={m.kyle_annotation ?? ""} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button name="action" value="approve" className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">Approve</button>
                <button name="action" value="reject" className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Reject</button>
                <button name="action" value="save" className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Save edits</button>
                {m.disclosed_metric_id && <span className="text-xs text-green-700 self-center">promoted to disclosed_metrics</span>}
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
