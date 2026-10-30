import type { Metadata } from "next";
import { Suspense } from "react";
import { PreviewClaimsExplorer } from "@/components/claims/PreviewClaimsExplorer";
import { SubmittedClaimsSection } from "@/components/claims/SubmittedClaimsSection";
import { SubmittedClaimsSkeleton } from "@/components/claims/SubmittedClaimsSkeleton";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPreviewClaims } from "@/lib/preview/sample-claims";

export const metadata: Metadata = { title: "My claims" };

export default function ClaimsPage() {
  return (
    <>
      <PageHeader
        title="My claims"
        description="Track the progress of claims you've filed."
        actions={<ButtonLink href="/claims/new">New claim</ButtonLink>}
      />

      <div className="space-y-8">
        {/* Real data — streamed in from the claims service. */}
        <section aria-labelledby="submitted-claims-heading">
          <Suspense fallback={<SubmittedClaimsSkeleton />}>
            <SubmittedClaimsSection />
          </Suspense>
        </section>

        {/* Fictional data — visually and structurally separate. */}
        <section aria-labelledby="preview-claims-heading">
          <PreviewClaimsExplorer claims={getPreviewClaims()} />
        </section>
      </div>
    </>
  );
}
