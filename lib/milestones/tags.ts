export const MILESTONE_TAGS = [
  "new_city",
  "technology",
  "operations",
  "partnership",
  "international",
  "safety",
  "financial",
  "scale_metrics",
] as const;

export type MilestoneTag = (typeof MILESTONE_TAGS)[number];

const TAG_LABELS: Record<MilestoneTag, string> = {
  new_city: "New City",
  technology: "Technology",
  operations: "Operations",
  partnership: "Partnership",
  international: "International",
  safety: "Safety",
  financial: "Financial",
  scale_metrics: "Scale Metrics",
};

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag as MilestoneTag] ?? tag;
}
