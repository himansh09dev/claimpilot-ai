import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { ClaimProcessing } from "@/lib/claims/types";

/** One badge summarizing the automated check for lists and dashboards. */
export function reviewBadge(processing: ClaimProcessing | null | undefined): { label: string; tone: BadgeTone } {
  if (!processing) return { label: "Not checked", tone: "neutral" };
  switch (processing.status) {
    case "pending":
    case "processing":
      return { label: "Checking…", tone: "info" };
    case "failed":
    case "skipped":
      return { label: "Manual review", tone: "warning" };
    default:
      return processing.assessment?.recommendation === "ready_for_review"
        ? { label: "No conflicts", tone: "success" }
        : { label: "Needs human review", tone: "warning" };
  }
}

export function ReviewBadge({ processing }: { processing: ClaimProcessing | null | undefined }) {
  const { label, tone } = reviewBadge(processing);
  return <Badge tone={tone}>{label}</Badge>;
}
