"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { controlClasses } from "@/components/ui/FormField";
import { STATUS_META, categoryLabel } from "@/lib/claims/format";
import { CLAIM_STATUSES, type Claim, type ClaimStatus } from "@/lib/claims/types";
import { ClaimsTable } from "./ClaimsTable";
import { PreviewBadge } from "./PreviewBadge";

/**
 * Search + filter over fictional preview claims.
 * Filter state lives in React state only (no URL params, no storage).
 */
export function PreviewClaimsExplorer({ claims }: { claims: readonly Claim[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClaimStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return claims.filter((claim) => {
      if (status !== "all" && claim.status !== status) return false;
      if (!q) return true;
      return [claim.id, claim.policyNumber, categoryLabel(claim.category), claim.description]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [claims, query, status]);

  const hasFilters = query !== "" || status !== "all";

  return (
    <Card>
      <CardHeader
        id="preview-claims-heading"
        title="Sample claims"
        description="Fictional examples showing how claims will look once the claims service is connected."
        action={<PreviewBadge />}
      />

      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="preview-search" className="sr-only">
            Search sample claims
          </label>
          <input
            id="preview-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by claim ID, policy or keyword"
            className={controlClasses(false, "h-10")}
          />
        </div>
        <div className="sm:w-48">
          <label htmlFor="preview-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="preview-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ClaimStatus | "all")}
            className={controlClasses(false, "h-10")}
          >
            <option value="all">All statuses</option>
            {CLAIM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="sr-only" role="status">
        {filtered.length} of {claims.length} sample claims shown
      </p>

      {filtered.length > 0 ? (
        <ClaimsTable claims={filtered} caption="Sample claims (preview data)" />
      ) : (
        <EmptyState
          title="No sample claims match"
          description="Try a different search term or status filter."
          action={
            hasFilters && (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      )}
    </Card>
  );
}
