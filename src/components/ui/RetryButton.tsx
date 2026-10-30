"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "./Button";

/** Re-runs the page's server data fetch (a real request to the claims API) without a full reload. */
export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      loadingText="Retrying…"
      onClick={() => startTransition(() => router.refresh())}
    >
      {label}
    </Button>
  );
}
