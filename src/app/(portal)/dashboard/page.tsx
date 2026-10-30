import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClaimStats } from "@/components/claims/ClaimStats";
import { ClaimsTable } from "@/components/claims/ClaimsTable";
import { PreviewBadge } from "@/components/claims/PreviewBadge";
import { SubmittedClaimsOverview } from "@/components/claims/SubmittedClaimsOverview";
import { SubmittedClaimsSkeleton } from "@/components/claims/SubmittedClaimsSkeleton";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPreviewClaims } from "@/lib/preview/sample-claims";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS = [
  {
    href: "/claims/new",
    title: "File a new claim",
    body: "Report an incident and attach your supporting PDF.",
  },
  {
    href: "/claims",
    title: "Track my claims",
    body: "See the status and history of claims you've filed.",
  },
] as const;

const CHECKLIST = [
  "Your policy number (CP- followed by 8 digits)",
  "The date the incident happened",
  "The amount you're claiming",
  "A receipt, invoice or report as a PDF (max 10 MB)",
];

export default function DashboardPage() {
  const previewClaims = getPreviewClaims();

  return (
    <>
      <PageHeader
        title="Welcome to ClaimPilot"
        description="File a claim in minutes and follow every step of its review."
        actions={<ButtonLink href="/claims/new">New claim</ButtonLink>}
      />

      <section aria-label="Your claims summary" className="mb-6">
        <Suspense fallback={<SubmittedClaimsSkeleton />}>
          <SubmittedClaimsOverview />
        </Suspense>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="quick-actions-heading">
            <h2 id="quick-actions-heading" className="sr-only">
              Quick actions
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {QUICK_ACTIONS.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="block h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
                  >
                    <span className="font-semibold text-slate-900">{action.title} →</span>
                    <span className="mt-1 block text-sm text-slate-600">{action.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <Card className="h-fit">
          <CardHeader title="Before you start" description="Have these ready to file a claim:" />
          <ul className="space-y-3 p-5 text-sm text-slate-700">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex gap-2">
                <svg className="mt-0.5 size-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Fictional preview — kept in its own clearly labeled section. */}
      <section aria-labelledby="dashboard-preview-heading" className="mt-10 rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="dashboard-preview-heading" className="text-lg font-semibold text-slate-900">
              Dashboard preview
            </h2>
            <p className="text-sm text-slate-600">
              How this dashboard will look with claims on file. All figures below are fictional.
            </p>
          </div>
          <PreviewBadge />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader as="h3" title="Sample claims at a glance" />
            <ClaimStats claims={previewClaims} label="Sample claim statistics (preview data)" />
          </Card>
          <Card>
            <CardHeader
              as="h3"
              title="Recent sample claims"
              action={
                <Link href="/claims" className="text-sm font-medium text-brand-700 hover:underline">
                  View all
                </Link>
              }
            />
            <ClaimsTable claims={previewClaims.slice(0, 3)} caption="Recent sample claims (preview data)" />
          </Card>
        </div>
      </section>
    </>
  );
}
