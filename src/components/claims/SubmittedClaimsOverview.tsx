import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RetryButton } from "@/components/ui/RetryButton";
import { listSubmittedClaims } from "@/lib/claims/claims-service";
import { ClaimStats } from "./ClaimStats";
import { ClaimsTable } from "./ClaimsTable";

const RECENT_LIMIT = 5;

/** Dashboard summary built ONLY from real submitted claims (DynamoDB via the claims API). */
export async function SubmittedClaimsOverview() {
  const result = await listSubmittedClaims();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Your claims at a glance" description="Live from the claims service." />
        {result.status === "ok" && result.data.length > 0 && (
          <ClaimStats claims={result.data} label="Your claim statistics" />
        )}
        {result.status === "ok" && result.data.length === 0 && (
          <EmptyState
            title="No claims yet"
            description="Claims you file will be summarized here."
            action={<ButtonLink href="/claims/new">Start a claim</ButtonLink>}
          />
        )}
        {result.status === "not_connected" && (
          <EmptyState
            title="Nothing to show yet"
            description="The claims service isn’t available in this environment, so there are no submitted claims to summarize."
          />
        )}
        {result.status === "error" && (
          <div className="p-5">
            <Alert tone="danger" role="alert" title="We couldn’t load your summary">
              <p>{result.message}</p>
              <div className="mt-3">
                <RetryButton />
              </div>
            </Alert>
          </div>
        )}
      </Card>

      {result.status === "ok" && result.data.length > 0 && (
        <Card>
          <CardHeader
            title="Recent claims"
            description="Current status and automated document check for your latest claims."
            action={
              <Link href="/claims" className="text-sm font-medium text-brand-700 hover:underline">
                View all ({result.data.length})
              </Link>
            }
          />
          <ClaimsTable claims={result.data.slice(0, RECENT_LIMIT)} caption="Your most recent claims" showCheck />
        </Card>
      )}
    </div>
  );
}
