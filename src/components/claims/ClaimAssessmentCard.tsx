import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/claims/format";
import type { ClaimProcessing, FieldCheck, ProcessingStatus } from "@/lib/claims/types";
import { ProcessingAutoRefresh } from "./ProcessingAutoRefresh";

const STATUS_BADGE: Record<ProcessingStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Queued", tone: "neutral" },
  processing: { label: "Running", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  completed_without_ai: { label: "Completed without AI summary", tone: "warning" },
  failed: { label: "Couldn’t run", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
};

/** Rule-check field → extraction alias, to show the exact quote each value was read from. */
const FIELD_ALIAS: Record<string, string> = {
  policyNumber: "POLICY_NUMBER",
  incidentDate: "INCIDENT_DATE",
  amount: "TOTAL_AMOUNT",
};

const RESULT_BADGE: Record<FieldCheck["result"], { label: string; tone: BadgeTone }> = {
  match: { label: "Matches", tone: "success" },
  mismatch: { label: "Differs", tone: "danger" },
  not_found: { label: "Not found", tone: "warning" },
  low_confidence: { label: "Unclear", tone: "warning" },
  unparsed: { label: "Unclear", tone: "warning" },
  info: { label: "Found", tone: "neutral" },
};

function List({ title, items, tone }: { title: string; items: string[]; tone: "danger" | "warning" | "neutral" }) {
  if (items.length === 0) return null;
  const color = tone === "danger" ? "text-rose-800" : tone === "warning" ? "text-amber-800" : "text-slate-700";
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className={`mt-1 list-disc space-y-1 pl-5 text-sm ${color}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Shows the automated document check written by the claimpilot-processor Lambda:
 * Amazon Bedrock document reading + rule checks + an Amazon Bedrock summary.
 * It is decision support only — a person reviews every claim.
 */
export function ClaimAssessmentCard({ processing }: { processing: ClaimProcessing }) {
  const badge = STATUS_BADGE[processing.status] ?? { label: processing.status, tone: "neutral" as const };
  const running = processing.status === "pending" || processing.status === "processing";
  const { assessment, extraction, ai } = processing;

  return (
    <Card>
      <CardHeader
        title="Automated document check"
        description="An Amazon Bedrock model reads the PDF, rules compare it with the claim, and a second model writes a summary. It never approves or rejects a claim."
        action={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />

      <div className="space-y-5 p-5">
        {running && (
          <div className="space-y-2" role="status">
            <p className="flex items-center gap-2 text-sm text-slate-700">
              <Spinner className="size-4 text-brand-600" />
              Checking the supporting document…
            </p>
            <ProcessingAutoRefresh />
          </div>
        )}

        {(processing.status === "failed" || processing.status === "skipped") && processing.error && (
          <Alert tone={processing.status === "failed" ? "danger" : "info"} title="Manual review needed">
            {processing.error.message}
          </Alert>
        )}

        {assessment && (
          <>
            <div
              className={
                assessment.recommendation === "needs_human_review"
                  ? "rounded-lg border border-amber-300 bg-amber-50 p-4"
                  : "rounded-lg border border-emerald-300 bg-emerald-50 p-4"
              }
            >
              <p className="text-sm font-semibold text-slate-900">
                {assessment.recommendation === "needs_human_review"
                  ? "Needs human review"
                  : "No conflicts found: ready for standard review"}
              </p>
              {assessment.reasons.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                  {assessment.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {assessment.explanationSource === "bedrock"
                  ? `AI-generated summary (Amazon Bedrock · ${ai?.modelId ?? "model"})`
                  : "Rule-based summary (AI summary unavailable)"}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{assessment.explanation}</p>
              {ai?.status === "failed" && ai.error && (
                <p className="mt-1 text-xs text-amber-800">AI step: {ai.error.message}</p>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Fields extracted from the document compared with the claim</caption>
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">Field</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Claim</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Document</th>
                    <th scope="col" className="py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {assessment.checks.map((check) => {
                    const result = RESULT_BADGE[check.result] ?? { label: check.result, tone: "neutral" as const };
                    return (
                      <tr key={check.field}>
                        <th scope="row" className="py-2 pr-3 font-medium text-slate-800">{check.label}</th>
                        <td className="py-2 pr-3 text-slate-700">{check.claimValue ?? "—"}</td>
                        <td className="py-2 pr-3 text-slate-700">
                          {check.documentValue ?? "—"}
                          {(() => {
                            const quote = extraction?.fields[FIELD_ALIAS[check.field] ?? check.field]?.quote;
                            return quote ? (
                              <span className="block text-xs italic text-slate-500">&ldquo;{quote}&rdquo;</span>
                            ) : null;
                          })()}
                        </td>
                        <td className="py-2">
                          <Badge tone={result.tone}>{result.label}</Badge>
                          {check.note && <span className="ml-2 text-xs text-slate-500">{check.note}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <List title="Inconsistencies" items={assessment.inconsistencies} tone="danger" />
            <List title="Missing or uncertain information" items={assessment.missingInformation} tone="warning" />
            {ai?.status === "ok" && (
              <>
                {ai.descriptionMatchesDocument && (
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">Document fits the described incident (AI): </span>
                    {{ yes: "Yes", no: "No", unclear: "Unclear" }[ai.descriptionMatchesDocument]}
                  </p>
                )}
                <List title="Points to note (AI, informational)" items={ai.additionalConcerns ?? []} tone="neutral" />
                <List title="Suggested questions for the claimant" items={ai.questionsForClaimant ?? []} tone="neutral" />
              </>
            )}
          </>
        )}

        {!running && (
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">Processing evidence</summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
              {processing.startedAt && (<><dt>Started</dt><dd>{formatDateTime(processing.startedAt)} UTC</dd></>)}
              {processing.completedAt && (<><dt>Finished</dt><dd>{formatDateTime(processing.completedAt)} UTC</dd></>)}
              {extraction && (
                <>
                  <dt>Document reading</dt>
                  <dd className="break-all font-mono">
                    {extraction.service} {extraction.api} · {extraction.modelId ?? "—"} · request {extraction.requestId ?? "—"}
                    {extraction.inputTokens != null && ` · ${extraction.inputTokens} in / ${extraction.outputTokens ?? 0} out tokens`}
                    {extraction.pages != null && ` · ${extraction.pages} page(s)`}
                  </dd>
                </>
              )}
              {processing.error?.evidence && (
                <>
                  <dt>{processing.error.evidence.service}</dt>
                  <dd className="break-all font-mono">
                    error {processing.error.code} · request {processing.error.evidence.requestId ?? "—"}
                  </dd>
                </>
              )}
              {ai && (
                <>
                  <dt>Summary</dt>
                  <dd className="break-all font-mono">
                    {ai.modelId ?? "—"} · {ai.status} · request {ai.requestId ?? "—"}
                    {ai.inputTokens != null && ` · ${ai.inputTokens} in / ${ai.outputTokens ?? 0} out tokens`}
                    {ai.latencyMs != null && ` · ${ai.latencyMs} ms`}
                  </dd>
                </>
              )}
            </dl>
          </details>
        )}
      </div>
    </Card>
  );
}
