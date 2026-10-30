"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

const INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 20; // ~80 seconds, then stop to protect the API's daily quota

/**
 * While the document check is running, re-fetches the page's server data
 * (a real GET to the claims API each time) until the status changes.
 */
export function ProcessingAutoRefresh() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return;
    const id = setTimeout(() => {
      router.refresh();
      setAttempts((n) => n + 1);
    }, INTERVAL_MS);
    return () => clearTimeout(id);
  }, [attempts, router]);

  if (attempts < MAX_ATTEMPTS) {
    return <p className="text-xs text-slate-500">This page updates automatically.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs text-slate-500">Still running. Check again in a moment.</p>
      <Button size="sm" variant="secondary" onClick={() => setAttempts(0)}>
        Check again
      </Button>
    </div>
  );
}
