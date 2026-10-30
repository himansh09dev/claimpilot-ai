# ADR 0002 — Phase 2: AWS claims API without an SDK

**Status:** Accepted · 2026-10-28

## Context
Phase 2 connects the portal to real AWS services under strict rules: $0 out of pocket (Free plan,
minimal credits), no AWS SDK, no local storage or mock APIs, PDFs go directly from the browser to a
private S3 bucket, and no AWS credentials in the browser.

## Decisions
1. **API Gateway REST API (not HTTP API).** Only REST APIs support API keys and usage plans,
   which give a hard daily quota (500 requests) and throttling. That caps credit usage.
2. **One Lambda behind Lambda proxy integration** for all four routes, instead of direct
   API Gateway → DynamoDB integrations. Creating a claim must verify the S3 object first, and the
   read routes would need hand-written VTL mapping templates. One function keeps validation and
   error format in one testable place.
3. **Hand-written SigV4** (node:crypto + fetch) for S3 and DynamoDB calls and for the presigned URL.
   It's verified against AWS's published S3 SigV4 examples (header-signed GET and PUT, presigned GET).
4. **Presigned PUT with signed `Content-Type` and `Content-Length`**, a server-chosen key
   (`uploads/<uuid>.pdf`) and a 300-second expiry. S3 rejects any other size or type.
5. **Next.js server as a thin proxy for metadata only.** It holds the API key in server-only env vars
   (`import "server-only"` enforces that at build time). The PDF never passes through it.
6. **Upload is verified before the claim is stored.** The Lambda reads the first 5 bytes of the object
   (exists, `%PDF-` signature, size, content type). The claim ID comes from the upload ID, and
   `attribute_not_exists` stops one upload from creating two claims.
7. **DynamoDB provisioned 5 RCU / 5 WCU, no auto scaling**, which stays inside Always Free.
   `Scan` (limit 100) is used for the list because the demo has a single shared list.

## Consequences / known limitations
- No end-user login: anyone who can reach the Next.js server can file and list claims. Real
  per-user access needs authentication (e.g. Cognito) and a per-user partition key with `Query`.
- Validation rules are duplicated in `index.mjs` because console-edited Lambda code can't import from
  the repo. Keep both copies in sync.
- The presigned URL includes the Lambda role's temporary session token. That's standard for
  presigned URLs, and the least-privilege role limits what it can do.
- Uploaded PDFs expire after 30 days (lifecycle rule); claim records keep the file name only.
