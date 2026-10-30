import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { listSubmittedClaims } from "@/lib/claims/claims-service";
import { RetryButton } from "@/components/ui/RetryButton";
import { ClaimsTable } from "./ClaimsTable";

/**
 * Real submitted claims, read from DynamoDB through the claims API — never from preview data.
 * Without API configuration the service reports "not_connected" and this renders an honest empty state.
 */
export async function SubmittedClaimsSection() {
  const result = await listSubmittedClaims();

  return (
    <Card>
      <CardHeader
        id="submitted-claims-heading"
        title="Your submitted claims"
        description="Claims confirmed by the ClaimPilot claims service."
      />

      {result.status === "not_connected" && (
        <EmptyState
          title="Claims service not configured"
          description={
            <>
              The claims service isn&apos;t available in this environment, so submitted claims
              can&apos;t be loaded right now.
            </>
          }
        />
      )}

      {result.status === "error" && (
        <div className="p-5">
          <Alert tone="danger" title="We couldn’t load your claims" role="alert">
            <p>{result.message}</p>
            <div className="mt-3">
              <RetryButton />
            </div>
          </Alert>
        </div>
      )}

      {result.status === "ok" &&
        (result.data.length > 0 ? (
          <ClaimsTable claims={result.data} caption="Your submitted claims" showCheck />
        ) : (
          <EmptyState
            title="You haven’t filed any claims"
            description="When you file a claim, you can track its progress here."
            action={<ButtonLink href="/claims/new">Start a claim</ButtonLink>}
          />
        ))}
    </Card>
  );
}
