# Phase 3 — Automated document check (Amazon Bedrock)

Region: **Asia Pacific (Sydney) `ap-southeast-2`**. Account `590251390597`.
Existing resources: bucket `claim-pilot`, table `claimpilots-claim`, Lambda `claimpilot-api`.

## What was verified on this account (2026-10-29)

| Check | Result |
|---|---|
| Textract `AnalyzeDocument` (from the processor Lambda) | ❌ `AccessDeniedException … explicit deny in a service control policy` |
| Textract `DetectDocumentText` (CloudShell) | ❌ same SCP deny. **Textract can't be used on this Free plan.** |
| Bedrock `apac.amazon.nova-micro-v1:0`, text | ✅ replied "OK" |
| Bedrock Nova Micro with a PDF document | ❌ `ValidationException: This model doesn't support documents.` |
| Bedrock `apac.amazon.nova-lite-v1:0` with the test PDF | ✅ returned "CP-12345678, 28/10/2026, $980.00" (1,629 input / 31 output tokens) |

## Cost position

| Service | Terms | Our usage |
|---|---|---|
| Amazon Bedrock | No free tier; per-token ([pricing](https://aws.amazon.com/bedrock/pricing/)). Paid from credits, approved by you. | Per claim: one Nova Lite call that reads the PDF (~1.5–2k tokens per page) and one Nova Micro call for the summary (~1k tokens). Capped at 50 claims/month and 3 pages per PDF. |
| DynamoDB Streams | Stream reads by a Lambda trigger are free | — |
| Lambda, CloudWatch Logs | Always Free | — |

`MONTHLY_LIMIT` (default 50) caps checks per month, and `0` switches them off. `MAX_PAGES` (default 3)
rejects longer PDFs before any model call.

## Flow

```
Portal ─▶ API Gateway ─▶ claimpilot-api ─▶ DynamoDB PutItem (processing.status = "pending")
                                                   │ DynamoDB Stream (INSERT, claimId starts with CLM-)
                                                   ▼
                                       claimpilot-processor (Lambda)
                       1. lock claim (pending → processing)           ─▶ DynamoDB UpdateItem
                       2. reserve monthly slot (USAGE#YYYY-MM)         ─▶ DynamoDB UpdateItem
                       3. read the PDF from private S3                 ─▶ S3 GetObject (stays in AWS)
                       4. Nova Lite reads the PDF → fields + quotes     ─▶ Bedrock Converse (document block)
                       5. rule checks: policy / date / amount
                       6. Nova Micro writes the explanation            ─▶ Bedrock Converse (text)
                       7. save result + timeline entry                 ─▶ DynamoDB UpdateItem
Portal claim page ◀── GET /claims/{id} shows the result (auto-refreshes while running)
```

The recommendation is only ever **"Needs human review"** or **"No conflicts found: ready for
standard review"**. It's decided by the rule checks, by whether the summary model ran, and by one
structured model answer: does the document fit the described incident (`yes` / `no` / `unclear`)?
The model's free-text concerns are shown as informational "points to note" and never decide. Every extracted value comes with the exact quote it was read from, and values
the model flags as hard to read show as **Unclear**. There are no confidence scores, because
language models don't produce calibrated ones.

---

## Step 1 — Update the claims API Lambda

Lambda → `claimpilot-api` → **Code** → replace `index.mjs` with the repo's
`aws/lambda/claimpilot-api/index.mjs` → **Deploy**.

## Step 2 — Turn on the DynamoDB stream

DynamoDB → `claimpilots-claim` → **Exports and streams** → *DynamoDB stream details* →
**Turn on** → view type **New image** → **Turn on stream**.

## Step 3 — Log group

CloudWatch → Log groups → **Create log group**: `/aws/lambda/claimpilot-processor`, retention **3 days**.

## Step 4 — IAM role for the processor

IAM → Roles → `claimpilot-processor-role` (create it if needed: AWS service → Lambda → no policies).
Set its inline policy `claimpilot-processor-least-privilege` to:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WriteOwnLogs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:ap-southeast-2:590251390597:log-group:/aws/lambda/claimpilot-processor:*"
    },
    {
      "Sid": "ReadClaimStream",
      "Effect": "Allow",
      "Action": ["dynamodb:DescribeStream", "dynamodb:GetRecords", "dynamodb:GetShardIterator", "dynamodb:ListStreams"],
      "Resource": "arn:aws:dynamodb:ap-southeast-2:590251390597:table/claimpilots-claim/stream/*"
    },
    {
      "Sid": "UpdateClaimsAndUsageCounter",
      "Effect": "Allow",
      "Action": "dynamodb:UpdateItem",
      "Resource": "arn:aws:dynamodb:ap-southeast-2:590251390597:table/claimpilots-claim"
    },
    {
      "Sid": "ReadClaimDocuments",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::claim-pilot/uploads/*"
    },
    {
      "Sid": "BedrockNovaLiteAndMicroOnly",
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": [
        "arn:aws:bedrock:ap-southeast-2:590251390597:inference-profile/apac.amazon.nova-lite-v1:0",
        "arn:aws:bedrock:ap-southeast-2:590251390597:inference-profile/apac.amazon.nova-micro-v1:0",
        "arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0",
        "arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0"
      ]
    }
  ]
}
```

Why each statement:
- **`s3:GetObject`**: the processor reads the PDF and passes it to Bedrock inside the request,
  so it never leaves AWS.
- **Bedrock**: the APAC profiles may route a request to another Asia-Pacific region, so the
  foundation-model ARNs use `*` for region. They're still limited to two models.
- **No Textract permission** (it's blocked anyway), no delete actions, and no other tables or buckets.

## Step 5 — Processor Lambda

Lambda → `claimpilot-processor` (create it if needed: Node.js 22.x+, arm64, existing role
`claimpilot-processor-role`):
- **Code**: paste `aws/lambda/claimpilot-processor/index.mjs` → **Deploy**
- Configuration → General: Memory **256 MB**, Timeout **1 min**
- Configuration → Environment variables:

| Key | Value |
|---|---|
| `TABLE_NAME` | `claimpilots-claim` |
| `BUCKET_NAME` | `claim-pilot` |
| `EXTRACTION_MODEL_ID` | `apac.amazon.nova-lite-v1:0` |
| `BEDROCK_MODEL_ID` | `apac.amazon.nova-micro-v1:0` |
| `MONTHLY_LIMIT` | `50` |
| `MAX_PAGES` | `3` |

## Step 6 — Connect the stream to the processor

`claimpilot-processor` → **Add trigger** → **DynamoDB** → table `claimpilots-claim`, batch size **1**,
starting position **Latest**, retry attempts **2**, maximum age of record **3600**, filter:

```json
{ "eventName": ["INSERT"], "dynamodb": { "NewImage": { "claimId": { "S": [{ "prefix": "CLM-" }] } } } }
```

---

## Step 7 — Tests (portal at http://localhost:3000)

Use the fictional PDFs in `docs/test-documents/`. Claim data for every test: policy
**CP-12345678**, incident date **2026-10-28**, category **Home**, amount **980**, any description.

| # | Attach / change | Expected on the claim page (within ~20 s) |
|---|---|---|
| T1 | `1-matching-invoice.pdf` | **Completed** · policy, date and amount **Match** · AI summary · **No conflicts found** |
| T2 | `2-mismatched-invoice.pdf` | **Completed** · date and amount **Differ** · **Needs human review** |
| T3 | `3-no-policy-number.pdf` | Policy number **Not found** · **Needs human review** |
| T4 | `4-two-pages.pdf` | **Completed** (2 pages ≤ `MAX_PAGES`) · matches as in T1 |
| T5 | Set `MAX_PAGES` = `1`, submit `4-two-pages.pdf`, then **restore 3** | **Couldn’t run**: too many pages · no Bedrock call |
| T6 | Set `BEDROCK_MODEL_ID` = `invalid`, submit T1's PDF, then **restore** | **Completed without AI summary** · rule-based summary · Needs human review |
| T7 | Set `MONTHLY_LIMIT` = `0`, submit any PDF, then **restore 50** | **Skipped** · no Bedrock call |
| T8 | `1-matching-invoice.pdf`, description `My parked car was hit by another car and the rear bumper was damaged.` | Fields **Match**, but "Document fits the described incident: **No** or **Unclear**" · **Needs human review** (verified: the model answered *Unclear*, because it only sees the extracted fields, not the invoice line items) |

## Step 8 — Evidence that real AWS processing happened

1. **Claim page → "Processing evidence"**: for both model calls, the model ID, Bedrock request ID,
   and input/output token counts.
2. **CloudWatch → `/aws/lambda/claimpilot-processor`**: `extraction_ok` and `bedrock_ok` lines with
   the same request IDs and token counts.
3. **DynamoDB → Explore items**: the claim's `processing` map, and the `USAGE#YYYY-MM` counter.
4. **CloudTrail → Event history**: event source `bedrock.amazonaws.com`.
5. **Billing → Bills** (next day): Bedrock token usage under Nova Lite and Nova Micro.

If a model call fails, the claim page shows the error type, AWS's message and the request ID.
It never shows a made-up result.

## Verification record (real AWS, 2026-10-29)

| Test | Claim | Result |
|---|---|---|
| T1 matching | `CLM-1F1B1EDE2E4B` | 3 × Match · fits incident: Yes · **ready for standard review** · Nova Lite `65503da6-…` (1957/255 tokens), Nova Micro `4eb1a822-…` (916/124) |
| T2 mismatched | `CLM-4B047B1C457F` | Date and amount Differ · Needs human review |
| T3 no policy | `CLM-C9E55C05130F` | Policy Not found · Needs human review (the model also missed the date: a real extraction limit, handled safely) |
| T4 two pages | `CLM-4DEB45F5CE3B` | Completed, 2 pages read |
| T5 page limit | `CLM-4EECDF6B9906` | Couldn't run, no model call |
| T6 summary model invalid | `CLM-220C4E910F12` | Completed without AI summary, rule-based summary |
| T7 cap = 0 | `CLM-6FA6C87B6481` | Skipped, no model call |
| T8 description mismatch | `CLM-CF3472D96FB5` | 3 × Match · fits incident: Unclear · **Needs human review** |
