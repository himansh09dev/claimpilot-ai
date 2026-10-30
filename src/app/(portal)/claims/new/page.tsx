import type { Metadata } from "next";
import Link from "next/link";
import { ClaimForm } from "@/components/claims/ClaimForm";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { isClaimsApiConfigured } from "@/lib/claims/claims-service";

export const metadata: Metadata = { title: "New claim" };

export default function NewClaimPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/claims" className="text-brand-700 hover:underline">
          ← Back to my claims
        </Link>
      </nav>
      <PageHeader
        title="File a new claim"
        description="Tell us what happened and attach a supporting document. It takes about 5 minutes."
      />
      {isClaimsApiConfigured() ? (
        <Alert tone="info" title="Demo portal — use fictional details only" className="mb-6">
          Claims are stored in this project&apos;s AWS account. Don&apos;t enter real personal
          information or upload real documents.
        </Alert>
      ) : (
        <Alert tone="warning" title="Claims API not configured" className="mb-6">
          You can fill in and check this form, but it can&apos;t be submitted because the claims
          service isn&apos;t available in this environment. Nothing you enter is saved or uploaded.
        </Alert>
      )}
      <ClaimForm />
    </div>
  );
}
