# Phase 2 — AWS setup (Console only)

Region for everything: **Asia Pacific (Sydney) `ap-southeast-2`**.
Do the steps **in order** and run each step's test before moving on. Stop and report any error.

> Cost rules: Free plan only. Never click **Upgrade**. Never enable: API Gateway caching,
> S3 Versioning, SSE-KMS, DynamoDB on-demand / auto scaling / point-in-time recovery,
> Lambda function URLs, provisioned concurrency, or X-Ray.

## Architecture

```
Browser ──(1) POST /api/uploads──▶ Next.js server ──x-api-key──▶ API Gateway ──▶ Lambda ──┐
   │                                                                                     │ presigns (SigV4)
   │◀──────────────────── presigned PUT URL (5 min, 1 key, 1 size, PDF only) ────────────┘
   │
   ├──(2) PUT PDF ─────────────────────────────────────────────────▶ S3 (private bucket)
   │
   └──(3) POST /api/claims ─▶ Next.js ─▶ API Gateway ─▶ Lambda ─▶ S3 GetObject (first 5 bytes: exists? PDF? size?)
                                                              └─▶ DynamoDB PutItem (no overwrite)
Pages (server components) ─▶ API Gateway GET /claims, GET /claims/{id} ─▶ Lambda ─▶ DynamoDB Scan / GetItem
```

- The browser never receives AWS credentials or the API key. The presigned URL contains a
  signature plus the Lambda role's *temporary* session token. It allows exactly one `PUT`
  of one object key, with the signed `Content-Type` and `Content-Length`, for 300 seconds.
- The Lambda uses no AWS SDK: it signs plain HTTPS requests with AWS Signature Version 4
  (`aws/lambda/claimpilot-api/index.mjs`, tested against AWS's published SigV4 examples).

## Resource names

| Resource | Name |
|---|---|
| S3 bucket | `claim-pilot` (written `BUCKET` below) |
| DynamoDB table | `claimpilots-claim` |
| CloudWatch log group | `/aws/lambda/claimpilot-api` |
| IAM role | `claimpilot-api-lambda-role` |
| Lambda function | `claimpilot-api` |
| API Gateway REST API / stage | `claimpilot-api` / `v1` |
| API key / usage plan | `claimpilot-web-server` / `claimpilot-demo-plan` |

Find your 12-digit account ID in the top-right account menu. It's written `ACCOUNT_ID` below.

---

## Step 1 — S3 bucket

If you haven't created the bucket yet, create it as described in the chat (general purpose,
ACLs disabled, **Block all public access ON**, versioning off, **SSE-S3**). Then:

**1a. CORS.** Bucket → *Permissions* → *Cross-origin resource sharing (CORS)* → *Edit*:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 600
  }
]
```

**1b. Bucket policy (HTTPS only).** *Permissions* → *Bucket policy* → *Edit* (replace `BUCKET`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::BUCKET", "arn:aws:s3:::BUCKET/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
```

This policy only *denies* access; it grants nothing to anyone.

**1c. Lifecycle (keeps storage tiny).** *Management* → *Create lifecycle rule*:
- Name `expire-claim-uploads`, scope: *Limit the scope… using filters* → Prefix `uploads/`
- ✅ *Expire current versions of objects* → **30** days
- ✅ *Delete expired object delete markers or incomplete multipart uploads* → incomplete multipart uploads after **1** day

**✅ Test 1:** *Permissions* still shows **Block all public access: On**.

## Step 2 — DynamoDB table

DynamoDB → *Tables* → *Create table*:
- Table name `claimpilots-claim`, Partition key `claimId` (**String**), no sort key
- Table settings: **Customize settings**
- Table class: **DynamoDB Standard**
- Read/write capacity: **Provisioned**
  - Read: Auto scaling **Off**, **5** units · Write: Auto scaling **Off**, **5** units
  - (Always Free covers 25 read + 25 write units per region in total.)
- No secondary indexes
- Encryption at rest: **Owned by Amazon DynamoDB**
- *Create table*

**✅ Test 2:** the table status becomes **Active**. *Backups* shows point-in-time recovery **Off**.

## Step 3 — CloudWatch log group (before the Lambda, to set short retention)

CloudWatch → *Logs* → *Log groups* → *Create log group*:
- Name `/aws/lambda/claimpilot-api`, Retention **3 days**, Log class **Standard**

## Step 4 — IAM role (least privilege)

IAM → *Roles* → *Create role*:
1. Trusted entity: **AWS service**, use case **Lambda** → *Next*
2. **Don't select any permission policies** → *Next*
3. Role name `claimpilot-api-lambda-role` → *Create role*
4. Open the role → *Add permissions* → *Create inline policy* → *JSON*. Paste this
   (replace `ACCOUNT_ID` and `BUCKET`), then name it `claimpilot-api-least-privilege`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WriteOwnLogs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:ap-southeast-2:ACCOUNT_ID:log-group:/aws/lambda/claimpilot-api:*"
    },
    {
      "Sid": "PresignAndVerifyClaimUploads",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::BUCKET/uploads/*"
    },
    {
      "Sid": "ClaimsTable",
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Scan"],
      "Resource": "arn:aws:dynamodb:ap-southeast-2:ACCOUNT_ID:table/claimpilots-claim"
    }
  ]
}
```

What each statement is for:
- `s3:PutObject` lets the presigned URL work: a presigned URL can only do what its signer may do.
- `s3:GetObject` lets the Lambda read the first 5 bytes of an upload to confirm it's a PDF.
- The role has no `s3:ListBucket`, no delete permission, and no access outside `uploads/`.

## Step 5 — Lambda function

Lambda → *Create function* → **Author from scratch**:
- Name `claimpilot-api`
- Runtime **Node.js 22.x** (or the newest Node.js LTS listed)
- Architecture **arm64**
- *Change default execution role* → **Use an existing role** → `claimpilot-api-lambda-role`
- *Additional configurations*: leave **Enable function URL** unchecked → *Create function*

Then:
1. **Code** tab: open `index.mjs`, replace everything with the contents of
   `aws/lambda/claimpilot-api/index.mjs` from this repo → **Deploy**.
2. *Configuration* → *General configuration* → *Edit*: Memory **128 MB**, Timeout **10 sec**.
3. *Configuration* → *Environment variables* → *Edit*:
   - `BUCKET_NAME` = your bucket name
   - `TABLE_NAME` = `claimpilots-claim`

**✅ Test 5a — presign.** Make a tiny test PDF (e.g. "Print → Save as PDF" of a blank page)
named `test.pdf`, and get its exact size in bytes:

```bash
stat -f%z test.pdf
```

*Test* tab → new event `presign`, replace `SIZE` with that number → *Test*:

```json
{
  "httpMethod": "POST",
  "resource": "/uploads",
  "body": "{\"fileName\":\"test.pdf\",\"contentType\":\"application/pdf\",\"sizeBytes\":SIZE}"
}
```

Expected: `statusCode: 200` and a body containing `uploadUrl` and `documentKey`.

**✅ Test 5b — direct upload to S3** (within 5 minutes; paste the `uploadUrl` in single quotes):

```bash
curl -i -X PUT -H "Content-Type: application/pdf" --data-binary @test.pdf 'UPLOAD_URL'
```

Expected `HTTP/1.1 200 OK`. The object appears under `uploads/` in the bucket.
Negative checks:
- Re-run with a different file: expect `403` with `SignatureDoesNotMatch` (the size is signed).
- Re-run after 5 minutes: expect `403` with `Request has expired`.

**✅ Test 5c — create claim.** New test event `create-claim` (use today's date as `YYYY-MM-DD`
and the `documentKey` from 5a):

```json
{
  "httpMethod": "POST",
  "resource": "/claims",
  "body": "{\"policyNumber\":\"CP-12345678\",\"incidentDate\":\"YYYY-MM-DD\",\"category\":\"home\",\"amount\":980,\"description\":\"Fictional test: water leaked from the flat upstairs and damaged the kitchen ceiling.\",\"documentKey\":\"DOCUMENT_KEY\",\"documentName\":\"test.pdf\"}"
}
```

Expected `statusCode: 201` with an `id` like `CLM-…`. DynamoDB → *Explore items* →
`claimpilots-claim` shows the item. Run the same event again: expect **409** (one upload creates one claim).

**✅ Test 5d — read.**

```json
{ "httpMethod": "GET", "resource": "/claims" }
```

```json
{ "httpMethod": "GET", "resource": "/claims/{claimId}", "pathParameters": { "claimId": "CLM_ID" } }
```

Expected: `200` for both. With `"claimId": "CLM-000000000000"` expect **404**.

**✅ Test 5e — errors.** In `create-claim`, change `documentKey` to
`uploads/00000000-0000-4000-8000-000000000000.pdf` → expect **422** `document_missing`.
Change `policyNumber` to `X` → expect **400** with `fieldErrors.policyNumber`.

If anything returns **500**: *Monitor* → *View CloudWatch logs*. The log line includes `awsType`
(e.g. `AccessDeniedException` usually means a typo in the IAM policy ARNs).

## Step 6 — API Gateway (REST API) + API key + usage plan

**6a. API and routes.** API Gateway → *Create API* → **REST API** → *Build*:
- *New API*, name `claimpilot-api`, endpoint type **Regional** → *Create API*

Create resources and methods. For every method use: Integration type **Lambda function**,
**Lambda proxy integration ON**, function `ap-southeast-2` / `claimpilot-api`.

| Resource path | Method |
|---|---|
| `/uploads` | `POST` |
| `/claims` | `GET`, `POST` |
| `/claims/{claimId}` (create under `/claims`, resource name `{claimId}`) | `GET` |

For each of the 4 methods: *Method request* → *Edit* → ✅ **API key required** → *Save*.
Don't enable CORS: the browser never calls API Gateway directly.

**6b. Deploy.** *Deploy API* → *New stage* `v1` → *Deploy*. Then *Stages* → `v1` → *Edit*:
- Cache: **off** · Throttling: rate **5**, burst **10** · CloudWatch logs: **off** · X-Ray: **off**

Copy the **Invoke URL** (`https://xxxx.execute-api.ap-southeast-2.amazonaws.com/v1`).

**6c. Key and usage plan.**
- *API keys* → *Create API key* → name `claimpilot-web-server`, **Auto generate** → *Save*
- *Usage plans* → *Create usage plan*: name `claimpilot-demo-plan`, throttling rate **5** burst **10**,
  quota **500 requests per day** → *Next* → *Add API stage*: `claimpilot-api` / `v1` →
  *Next* → *Add API key*: `claimpilot-web-server` → *Create*

**✅ Test 6** (replace URL and key):

```bash
curl -i 'INVOKE_URL/claims'
```

Expected `403 {"message":"Forbidden"}` (no key).

```bash
curl -i -H 'x-api-key: API_KEY' 'INVOKE_URL/claims'
```

Expected `200` and `{"claims":[…]}` containing the claim from Step 5.

## Step 7 — Connect the portal

Create `.env.local` in the project root (it's git-ignored and never sent to the browser):

```
CLAIMS_API_URL=https://xxxx.execute-api.ap-southeast-2.amazonaws.com/v1
CLAIMS_API_KEY=the-api-key-value
```

Restart `npm run dev`, open http://localhost:3000.

**✅ Test 7 — end to end**
1. The header badge says **Claims API connected**. `/claims` lists the claim from Step 5.
2. `/claims/new` → fill in fictional data, attach a small PDF → *Submit claim*. The button
   shows *Preparing secure upload… → Uploading PDF… % → Saving your claim…*, then the
   green **Claim CLM-… submitted** message appears.
3. DevTools → Network: the `PUT` goes to `BUCKET.s3.ap-southeast-2.amazonaws.com`, not to `localhost`.
4. The new object is in S3 under `uploads/`, and the new item is in DynamoDB.
5. Open the claim from the success message: its details and "Received" status come from DynamoDB.

## Step 8 — Real status changes

DynamoDB → *Explore items* → open a claim → change `status` to `in_review`
(allowed values: `received`, `in_review`, `needs_info`, `approved`, `rejected`) → *Save*.
Reload `/claims` and the claim page: the badge shows **In review**.

## Step 9 — Error handling in the portal

| Do this | Expect |
|---|---|
| Set a wrong `CLAIMS_API_KEY`, restart | Claims pages: "We couldn’t load your claims" |
| Remove both env vars, restart | Badge "Claims API not configured"; submit shows "has not been submitted" |
| Rename a `.txt` to `.pdf` and attach it | Rejected in the browser before anything is sent |
| `/claims/CLM-000000000000` | 404 page |

## Step 10 — Cost check (after ~24 h)

*Billing and Cost Management* → *Bills* and *Free Tier*. Expected usage for all of the above
(well under 100 requests): Lambda, DynamoDB and CloudWatch Logs within Always Free; API Gateway
and S3 request/storage charges of a fraction of a cent, taken from credits.

## Teardown (when you want to stop all usage)

Delete in this order: API Gateway `claimpilot-api` → API key and usage plan → Lambda
`claimpilot-api` → DynamoDB table → empty and delete the S3 bucket → log group → IAM role.
