import { Badge } from "@/components/ui/Badge";
import { STATUS_META } from "@/lib/claims/format";
import type { ClaimStatus } from "@/lib/claims/types";

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  // Statuses come from DynamoDB, where they can be edited by hand — tolerate unknown values.
  const meta = (STATUS_META as Partial<typeof STATUS_META>)[status] ?? {
    label: "Unknown status",
    tone: "neutral" as const,
  };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
