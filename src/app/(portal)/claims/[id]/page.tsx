import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimDetails } from "@/components/claims/ClaimDetails";
import { ClaimStatusBadge } from "@/components/claims/ClaimStatusBadge";
import { PreviewBadge } from "@/components/claims/PreviewBadge";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { RetryButton } from "@/components/ui/RetryButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSubmittedClaim } from "@/lib/claims/claims-service";
import { getPreviewClaim, isPreviewClaimId } from "@/lib/preview/sample-claims";

interface ClaimPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ClaimPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Claim ${decodeURIComponent(id)}` };
}

function BackLink() {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <Link href="/claims" className="text-brand-700 hover:underline">
        ← Back to my claims
      </Link>
    </nav>
  );
}

export default async function ClaimPage({ params }: ClaimPageProps) {
  const id = decodeURIComponent((await params).id);

  // Preview IDs ("PRV-…") resolve ONLY against fictional sample data.
  if (isPreviewClaimId(id)) {
    const claim = getPreviewClaim(id);
    if (!claim) notFound();

    return (
      <>
        <BackLink />
        <PageHeader
          eyebrow={<PreviewBadge label="Preview data — fictional claim" />}
          title={<span className="font-mono">{claim.id}</span>}
          actions={<ClaimStatusBadge status={claim.status} />}
        />
        <Alert tone="info" title="This is a sample claim" className="mb-6">
          It shows how a claim&apos;s details and progress will be displayed. It isn&apos;t a real
          claim and no real person, policy or document is involved.
        </Alert>
        <ClaimDetails claim={claim} />
      </>
    );
  }

  // Any other ID is treated as a real claim and must come from the claims service.
  const result = await getSubmittedClaim(id);

  if (result.status === "ok") {
    if (!result.data) notFound();
    return (
      <>
        <BackLink />
        <PageHeader
          title={<span className="font-mono">{result.data.id}</span>}
          actions={<ClaimStatusBadge status={result.data.status} />}
        />
        <ClaimDetails claim={result.data} />
      </>
    );
  }

  return (
    <>
      <BackLink />
      <PageHeader title={<span className="font-mono">{id}</span>} />
      {result.status === "not_connected" ? (
        <Alert tone="warning" role="alert" title="We can’t load this claim yet">
          The claims service isn&apos;t available in this environment, so real claim details
          can&apos;t be shown. Sample claims (IDs starting with PRV-) can be viewed from My claims.
        </Alert>
      ) : (
        <Alert tone="danger" role="alert" title="We couldn’t load this claim">
          <p>{result.message}</p>
          <div className="mt-3">
            <RetryButton />
          </div>
        </Alert>
      )}
      <div className="mt-6">
        <ButtonLink href="/claims" variant="secondary">
          View my claims
        </ButtonLink>
      </div>
    </>
  );
}
