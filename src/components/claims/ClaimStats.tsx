import { formatCurrency } from "@/lib/claims/format";
import type { Claim } from "@/lib/claims/types";

interface Stat {
  label: string;
  value: string;
}

export function summarizeClaims(claims: readonly Claim[]): Stat[] {
  const open = claims.filter((c) => ["received", "in_review", "needs_info"].includes(c.status));
  const flagged = claims.filter(
    (c) =>
      c.status === "needs_info" ||
      (c.processing && c.processing.status !== "pending" && c.processing.status !== "processing" &&
        c.processing.assessment?.recommendation !== "ready_for_review"),
  );
  const approvedTotal = claims
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + c.amount, 0);

  return [
    { label: "Total claims", value: String(claims.length) },
    { label: "Open claims", value: String(open.length) },
    { label: "Flagged for review", value: String(flagged.length) },
    { label: "Approved amount", value: formatCurrency(approvedTotal) },
  ];
}

export function ClaimStats({ claims, label }: { claims: readonly Claim[]; label: string }) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl bg-slate-200 lg:grid-cols-4">
      {summarizeClaims(claims).map((stat) => (
        <div key={stat.label} className="bg-white px-5 py-4">
          <dt className="text-sm text-slate-600">{stat.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
