import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { categoryLabel, formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/claims/format";
import type { Claim } from "@/lib/claims/types";
import { ClaimAssessmentCard } from "./ClaimAssessmentCard";
import { ClaimStatusBadge } from "./ClaimStatusBadge";
import { ReviewBadge } from "./ReviewBadge";
import { ClaimTimeline } from "./ClaimTimeline";

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function ClaimDetails({ claim }: { claim: Claim }) {
  const isPreview = claim.origin === "preview";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Claim summary" />
          <dl className="grid gap-5 p-5 sm:grid-cols-2">
            <DetailItem label="Policy number">
              <span className="font-mono">{claim.policyNumber}</span>
            </DetailItem>
            <DetailItem label="Category">{categoryLabel(claim.category)}</DetailItem>
            <DetailItem label="Incident date">{formatDate(claim.incidentDate)}</DetailItem>
            <DetailItem label="Claim amount">
              <span className="font-semibold tabular-nums">{formatCurrency(claim.amount)}</span>
            </DetailItem>
            <DetailItem label="Filed">{formatDateTime(claim.createdAt)} UTC</DetailItem>
          </dl>
          <div className="border-t border-slate-200 p-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</h3>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-slate-800">{claim.description}</p>
          </div>
        </Card>

        {claim.processing && <ClaimAssessmentCard processing={claim.processing} />}

        <Card>
          <CardHeader title="Supporting document" />
          <div className="p-5">
            {claim.document ? (
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-rose-50 text-xs font-semibold text-rose-700" aria-hidden="true">
                  PDF
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{claim.document.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(claim.document.sizeBytes)} · uploaded {formatDateTime(claim.createdAt)} UTC
                    {isPreview && " · sample file name only — no document exists"}
                  </p>
                  {!isPreview && (
                    <p className="mt-1 text-xs text-slate-500">
                      Stored privately in Amazon S3 (encrypted, not publicly accessible)
                      {claim.processing?.extraction?.documentType &&
                        ` · recognised as: ${claim.processing.extraction.documentType}`}
                      {claim.processing?.extraction?.pages != null &&
                        ` · ${claim.processing.extraction.pages} page(s)`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">No document attached.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="h-fit space-y-6">
        {!isPreview && (
          <Card>
            <CardHeader title="Review status" />
            <div className="space-y-4 p-5 text-sm">
              <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Claim status</dt>
                <dd className="mt-1">
                  <ClaimStatusBadge status={claim.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Automated document check</dt>
                <dd className="mt-1">
                  <ReviewBadge processing={claim.processing} />
                </dd>
              </div>
              </dl>
              <p className="text-xs text-slate-500">
                A claims handler reviews every claim and sets its status. The automated check only
                highlights what to look at. It never approves or rejects a claim.
              </p>
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="Progress" />
          <div className="p-5">
            {claim.timeline.length > 0 ? (
              <ClaimTimeline events={claim.timeline} />
            ) : (
              <p className="text-sm text-slate-600">No updates yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
