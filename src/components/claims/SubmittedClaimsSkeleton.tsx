import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function SubmittedClaimsSkeleton() {
  return (
    <Card className="space-y-4 p-5" role="status" aria-live="polite">
      <span className="sr-only">Loading your submitted claims…</span>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <Skeleton className="h-24 w-full" />
    </Card>
  );
}
