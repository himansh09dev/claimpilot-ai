# Demo walkthrough (about 5 minutes)

A script for showing ClaimPilot AI in an interview or a screen recording. It uses the fictional PDFs in
`docs/test-documents/`. Every result shown comes from real AWS calls; nothing is pre-recorded.

**Before the demo**
- `npm run dev`. The header badge should say **Claims API connected**.
- Have the AWS Console open on DynamoDB (`claimpilots-claim` → Explore items) and on CloudWatch
  (`/aws/lambda/claimpilot-processor`).
- Each live submission costs a fraction of a cent of Bedrock usage.

## 1. The problem (30 s)
"Insurers get supporting documents that don't match the claim: wrong policy, wrong amount, or a
document for a different incident. ClaimPilot checks each document automatically, but **never
decides a claim**. It highlights what a human should look at."

## 2. Dashboard (30 s): http://localhost:3000/dashboard
- The stats and **Recent claims** come live from DynamoDB through API Gateway.
- Point out the two columns:
  - **Status**: set by a human reviewer
  - **Document check**: the automated result (No conflicts / Needs human review / Manual review)
- The dashed **preview** section underneath is fictional sample data, kept visibly separate.

## 3. File a claim (60 s): New claim
Fill in the form:

| Field | Value |
|---|---|
| Policy number | `CP-12345678` |
| Incident date | `2026-10-28` |
| Category | Home & Property |
| Amount | `980` |
| What happened? | `Water leaked from the flat upstairs and damaged our kitchen ceiling; it needed plaster and paint.` |
| Document | `1-matching-invoice.pdf` |

Submit and narrate the button text, which tracks three real steps:
1. *Preparing secure upload*: the server returns a presigned S3 URL locked to this file's size and type.
2. *Uploading PDF*: the browser uploads **straight to the private S3 bucket**. Show the DevTools
   Network tab: the PUT goes to `claim-pilot.s3.ap-southeast-2.amazonaws.com`.
3. *Saving your claim*: the Lambda confirms the PDF is really in S3, then writes to DynamoDB.

The success message only appears after DynamoDB confirms the save.

## 4. Automated check (60 s): open the claim
The card moves from **Checking…** to **Completed** within about 15 seconds:
- **Extracted fields**: each value has the exact quote it was read from (Nova Lite reads the PDF).
- **Rule checks**: policy, date and amount show **Matches**, decided by code rather than the model.
- **AI summary** (Nova Micro), plus "Document fits the described incident: **Yes**".
- **No conflicts found: ready for standard review**.
- Open **Processing evidence**: model IDs, Bedrock request IDs and token counts.

Then show the same request IDs in CloudWatch, and the stored `processing` map in DynamoDB.

## 5. The safety story (60 s)
- Submit `2-mismatched-invoice.pdf` with the same form values. Date and amount show **Differs**,
  with 2 inconsistencies listed, and **Needs human review**.
- Mention: in the T8 test, a car-crash description with a ceiling-repair invoice was flagged even
  though all the numbers matched.
- Retry safety: double submissions return the same claim. The processor locks each claim, so retries
  can't run it twice.

## 6. Constraints and trade-offs (30 s)
- No AWS SDK: requests are signed by hand with SigV4, tested against AWS's published examples.
- **Textract was blocked** by the Free plan's organization policy. That was verified, documented, and
  replaced with Bedrock document reading.
- Cost guards: an API quota of 500/day, at most 50 AI checks a month, PDFs up to 3 pages, and a
  `MONTHLY_LIMIT=0` kill switch.
