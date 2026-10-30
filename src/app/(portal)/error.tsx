"use client";

import { useEffect } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";

/** Route-level error boundary for every portal page. */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-8">
      <Alert tone="danger" role="alert" title="Something went wrong on this page">
        <p>An unexpected error occurred. You can try again, or head back to your dashboard.</p>
        {error.digest && <p className="mt-1 font-mono text-xs">Reference: {error.digest}</p>}
      </Alert>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/dashboard" variant="secondary">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
