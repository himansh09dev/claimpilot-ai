# ADR 0003 — Phase 3: automated document check with Textract and Bedrock

**Status:** Accepted · 2026-10-29

## Context
Claims should get an automated check of their supporting PDF: extract fields, compare them with the
form, explain the findings and flag cases for human review. Constraints: no AWS SDK, documents stay in
private S3, minimal cost. Textract has a 3-month free tier for new accounts. Bedrock has no free tier,
and the user approved a tiny amount of credits for it.

## Decisions
1. **DynamoDB Streams → separate processor Lambda.** Processing starts only after the claim item exists
   (which already implies the PDF was verified in S3). The API stays fast, and stream reads by a
   Lambda trigger are free. An event filter passes only `INSERT`s of `CLM-` items, so the processor's
   own updates can't trigger it again.
2. **Textract `AnalyzeDocument` with Queries, synchronous.** Queries return labelled answers with
   confidence scores. The synchronous API accepts only single-page PDFs, which caps billing at one
   page per claim. Multi-page PDFs get an honest "couldn't run, manual review" result.
3. **Rules decide matches; the model explains.** Deterministic code compares policy, date and amount.
   Nova Micro (Converse API, temperature 0) writes the explanation and may add concerns. Model output
   is parsed against a strict shape, unknown keys are dropped, and the model can never set the
   recommendation. The only outcomes are `needs_human_review` and `ready_for_review`.
4. **Prompt-injection hygiene.** Document text is passed as delimited untrusted data, and the system
   prompt tells the model to ignore instructions inside it. Even if it complied, it can't change the
   recommendation or the rule findings.
5. **Idempotency and cost guards.** A conditional lock (`pending → processing`, stale after 5 min) stops
   double processing on stream retries. A conditional counter `USAGE#YYYY-MM` caps checks per month
   (`MONTHLY_LIMIT`, 0 = off).
6. **Evidence stored with results.** Textract and Bedrock request IDs, token counts and latency are saved
   on the claim and logged to CloudWatch.
7. **The processor has its own SigV4 signer**, cross-checked against AWS's reference signer. For non-S3
   services, it applies the extra path encoding needed for Bedrock model IDs that contain `:`.

## Consequences
- Textract's free tier ends 3 months after account creation (about mid-January 2027). After that, each page
  uses credits. Set `MONTHLY_LIMIT=0` to stop.
- Multi-page documents are not checked automatically.
- The SigV4 code is duplicated across the two Lambdas because console-edited functions can't share files.

## Amendment — 2026-10-29: Textract is blocked; Bedrock reads the PDF

**Finding:** both `textract:AnalyzeDocument` (from the processor role) and `textract:DetectDocumentText`
(from CloudShell) returned `AccessDeniedException … explicit deny in a service control policy`. The
SCP belongs to the AWS-managed organization behind the Free plan. It can't be changed without
upgrading the plan, which is ruled out. Nova Micro rejects PDF input ("This model doesn't support
documents"). Nova Lite accepted the test PDF and returned the correct values.

**Changes to the decisions above:**
- Decision 2 is replaced: the processor reads the PDF from private S3 and sends it to **Nova Lite** as a
  Converse `document` block. The model returns each field with a **verbatim quote** and a `clear` flag.
  There are no confidence scores, because models don't produce calibrated ones.
- Page cost control moves from "sync Textract = 1 page" to `MAX_PAGES` (page objects counted in the PDF
  before any model call) plus the 4.5 MB Converse document limit.
- **Nova Micro** (text only, cheaper) still writes the explanation from the extracted fields and rule
  results. Rules still decide matches. Recommendations are still review-only.
- Bedrock errors are classified from the `x-amzn-errortype` response header (REST-JSON protocol). The
  type, AWS's message and the request ID are stored with failed results.
- IAM: the Textract permission is removed, and `bedrock:InvokeModel` is allowed for Nova Lite and Nova Micro only.

## Amendment — 2026-10-29 (after real tests): structured answer instead of free-text concerns

Real runs showed that Nova Micro doesn't reliably follow "don't flag X" instructions. It raised format
and missing-name concerns and repeated rule findings, so free-text `additionalConcerns` made
"ready for standard review" almost unreachable. The recommendation now uses one structured field,
`descriptionMatchesDocument` (`yes` / `no` / `unclear`; any other value counts as `unclear`), plus the
rule results and AI availability. Free-text concerns are shown as informational "points to note" only.
