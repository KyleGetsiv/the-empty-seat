"use client";

// One reviewable mention in the earnings review queue (module 4.5).
//
// This is a client component for one reason: the needs-a-number guard has to
// react to the type select and the value input as they change, and a server
// component cannot. The server action is passed in as a prop and the card is
// still a plain form post, so the page keeps working the way the rest of the
// admin does.

import { useState } from "react";
import Link from "next/link";
import { MENTION_TYPES, resolvePromotionSlug, metricLabel } from "@/lib/earnings-mentions";

export interface MentionCardData {
  id: string;
  quote_text: string;
  speaker: string | null;
  page_or_timestamp: string | null;
  confidence: string;
  review_status: string;
  mention_type: string;
  kyle_annotation: string | null;
  disclosed_metric_id: string | null;
  metric_value: number | null;
  metric_label: string | null;
  // The model's own reading of which quantity the quote measures (4.12).
  // This, not mention_type, decides what approving publishes.
  metric_slug: string | null;
}

export function MentionCard({
  mention,
  action,
  sourceHref,
}: {
  mention: MentionCardData;
  action: (formData: FormData) => void;
  sourceHref: string | null;
}) {
  const [mentionType, setMentionType] = useState(mention.mention_type);
  const [metricValue, setMetricValue] = useState(mention.metric_value?.toString() ?? "");
  const [approveWithoutNumber, setApproveWithoutNumber] = useState(false);

  // 4.12: the publish target follows the model's slug, with the type as
  // fallback. Shown explicitly below, because otherwise a reviewer picks
  // "ride_count", watches it file as cumulative trips, and has nothing on
  // screen explaining why.
  const promotesTo = resolvePromotionSlug(mention.metric_slug, mentionType);
  const hasNumber = metricValue.trim() !== "" && Number(metricValue) > 0;
  // A metric-type mention with no number can never reach disclosed_metrics.
  // Approving it silently is how a disclosure goes missing from the site, so
  // the approve path is closed until there is a number or a deliberate opt-out.
  const needsNumber = Boolean(promotesTo) && !hasNumber;
  const approveBlocked = needsNumber && !approveWithoutNumber;

  const border =
    mention.review_status === "approved"
      ? "border-green-200"
      : mention.review_status === "rejected"
        ? "border-gray-200 opacity-60"
        : needsNumber
          ? "border-amber-400"
          : "border-amber-200";

  return (
    <form action={action} className={`rounded-lg border bg-white p-5 ${border}`}>
      <input type="hidden" name="mention_id" value={mention.id} />
      <div className="flex items-start justify-between gap-4 mb-3">
        <blockquote className="text-sm text-gray-900 leading-relaxed border-l-2 border-gray-300 pl-3">
          {mention.quote_text}
        </blockquote>
        <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
          {mention.review_status} | {mention.confidence}
        </span>
      </div>
      <div className="text-xs text-gray-500 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{mention.speaker ? mention.speaker : "filing text"}</span>
        {sourceHref && mention.page_or_timestamp && (
          <>
            <span className="text-gray-300">|</span>
            <Link href={sourceHref} className="text-blue-600 hover:underline">
              read {mention.page_or_timestamp} in the stored source
            </Link>
          </>
        )}
        {mention.metric_label && (
          <>
            <span className="text-gray-300">|</span>
            <span>extracted: {mention.metric_label}</span>
          </>
        )}
        <span className="text-gray-300">|</span>
        {promotesTo ? (
          <span className="text-gray-700">
            publishes as <span className="font-medium">{metricLabel(promotesTo)}</span>
            {mention.metric_slug && mention.metric_slug !== promotesTo && (
              <span className="text-gray-500"> (model read {mention.metric_slug})</span>
            )}
          </span>
        ) : (
          <span>publishes no figure</span>
        )}
      </div>

      {needsNumber && mention.review_status === "pending" && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This mention would publish as {promotesTo ? metricLabel(promotesTo) : "a figure"} but
          carries no number, so approving it publishes nothing. Enter the figure the quote states,
          or change the type, or approve it as commentary only.
          <label className="mt-2 flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              name="approve_without_number"
              checked={approveWithoutNumber}
              onChange={(e) => setApproveWithoutNumber(e.target.checked)}
              className="rounded border-amber-400"
            />
            Approve without promoting a number
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            name="mention_type"
            value={mentionType}
            onChange={(e) => setMentionType(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {MENTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Metric value {promotesTo ? `(promotes to ${promotesTo} on approve)` : ""}
          </label>
          <input
            name="metric_value"
            type="number"
            step="any"
            value={metricValue}
            onChange={(e) => setMetricValue(e.target.value)}
            placeholder={promotesTo ? "e.g. 500000" : ""}
            className={`w-full rounded border px-2 py-1.5 text-sm ${needsNumber ? "border-amber-400 bg-amber-50" : "border-gray-300"}`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Annotation</label>
          <input
            name="kyle_annotation"
            defaultValue={mention.kyle_annotation ?? ""}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          name="action"
          value="approve"
          disabled={approveBlocked}
          title={approveBlocked ? "Enter a number or tick approve without promoting" : undefined}
          className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Approve
        </button>
        <button name="action" value="reject" className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
          Reject
        </button>
        <button name="action" value="save" className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
          Save edits
        </button>
        {mention.disclosed_metric_id && (
          <span className="text-xs text-green-700">promoted to disclosed_metrics</span>
        )}
      </div>
    </form>
  );
}
