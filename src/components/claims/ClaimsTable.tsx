import Link from "next/link";
import { categoryLabel, formatCurrency, formatDate } from "@/lib/claims/format";
import type { Claim } from "@/lib/claims/types";
import { ClaimStatusBadge } from "./ClaimStatusBadge";
import { ReviewBadge } from "./ReviewBadge";

interface ClaimsTableProps {
  claims: readonly Claim[];
  caption: string;
  /** Show the automated document-check column (real submitted claims only). */
  showCheck?: boolean;
}

/**
 * Responsive list: a semantic <table> on md+ screens, stacked cards on mobile.
 * Both render from the same data so they can't drift apart.
 */
export function ClaimsTable({ claims, caption, showCheck = false }: ClaimsTableProps) {
  return (
    <>
      <ul className="divide-y divide-slate-200 md:hidden" aria-label={caption}>
        {claims.map((claim) => (
          <li key={claim.id}>
            <Link href={`/claims/${claim.id}`} className="block px-5 py-4 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm font-medium text-brand-700">{claim.id}</span>
                <ClaimStatusBadge status={claim.status} />
              </div>
              <p className="mt-1 text-sm text-slate-900">{categoryLabel(claim.category)}</p>
              <div className="mt-1 flex justify-between text-sm text-slate-600">
                <span>Incident {formatDate(claim.incidentDate)}</span>
                <span className="font-medium text-slate-900">{formatCurrency(claim.amount)}</span>
              </div>
              {showCheck && (
                <div className="mt-2 text-xs text-slate-600">
                  Document check: <ReviewBadge processing={claim.processing} />
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Claim</th>
              <th scope="col" className="px-5 py-3 font-medium">Category</th>
              <th scope="col" className="px-5 py-3 font-medium">Incident date</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Amount</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
              {showCheck && <th scope="col" className="px-5 py-3 font-medium">Document check</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {claims.map((claim) => (
              <tr key={claim.id} className="hover:bg-slate-50">
                <th scope="row" className="px-5 py-3 font-normal">
                  <Link href={`/claims/${claim.id}`} className="font-mono font-medium text-brand-700 hover:underline">
                    {claim.id}
                  </Link>
                  <div className="text-xs text-slate-500">Policy {claim.policyNumber}</div>
                </th>
                <td className="px-5 py-3 text-slate-700">{categoryLabel(claim.category)}</td>
                <td className="px-5 py-3 text-slate-700">{formatDate(claim.incidentDate)}</td>
                <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">
                  {formatCurrency(claim.amount)}
                </td>
                <td className="px-5 py-3">
                  <ClaimStatusBadge status={claim.status} />
                </td>
                {showCheck && (
                  <td className="px-5 py-3">
                    <ReviewBadge processing={claim.processing} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
