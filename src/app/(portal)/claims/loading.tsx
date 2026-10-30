import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/** Shown by Next.js while a claims route is loading (wraps the page in Suspense). */
export default function ClaimsLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading claims…</span>
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-80 max-w-full" />
      <Card className="space-y-4 p-5">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </Card>
    </div>
  );
}
