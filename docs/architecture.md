# ClaimPilot AI — Architecture

All AWS resources live in **ap-southeast-2 (Sydney)**. The portal runs locally (`npm run dev`); it is
**not deployed publicly**.

## Components

```mermaid
flowchart LR
  subgraph Browser["Browser (customer)"]
    UI["Next.js pages<br/>dashboard · claim form · claim details"]
  end

  subgraph Next["Next.js server (localhost:3000)"]
    RH["Route handlers<br/>POST /api/uploads · POST /api/claims"]
    SC["Server components<br/>list / get claims"]
    ENV[(".env.local<br/>CLAIMS_API_URL · CLAIMS_API_KEY<br/>server-only")]
  end

  subgraph AWS["AWS · ap-southeast-2"]
    APIGW["API Gateway (REST)<br/>stage v1 · API key + usage plan<br/>5 req/s · 500/day"]
    L1["Lambda claimpilot-api<br/>validation · presigning (SigV4)"]
    S3[("S3 claim-pilot<br/>private · SSE-S3 · HTTPS-only<br/>uploads/ expire after 30 days")]
    DDB[("DynamoDB claimpilots-claim<br/>provisioned 5/5 · stream: NEW_IMAGE")]
    L2["Lambda claimpilot-processor<br/>lock · cap · rules"]
    BR["Amazon Bedrock<br/>Nova Lite: reads PDF<br/>Nova Micro: summary"]
    CW[("CloudWatch Logs<br/>3-day retention")]
  end

  UI -- "1 · file metadata" --> RH
  UI -- "4 · claim details" --> RH
  UI -- "page loads" --> SC
  RH -- "x-api-key" --> APIGW
  SC -- "x-api-key" --> APIGW
  ENV -.-> RH
  ENV -.-> SC
  APIGW --> L1
  L1 -- "2 · presigned PUT URL (5 min)" --> UI
  UI == "3 · PDF upload (direct)" ==> S3
  L1 -- "verify first bytes" --> S3
  L1 -- "PutItem / GetItem / Scan" --> DDB
  DDB -- "5 · stream: INSERT CLM-*" --> L2
  L2 -- "GetObject" --> S3
  L2 -- "Converse (document + text)" --> BR
  L2 -- "UpdateItem (result)" --> DDB
  L1 -.-> CW
  L2 -.-> CW
```

## Submission sequence

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant N as Next.js server
  participant G as API Gateway
  participant A as claimpilot-api
  participant S as S3 (private)
  participant D as DynamoDB
  participant P as claimpilot-processor
  participant M as Bedrock

  B->>N: POST /api/uploads {name, size}
  N->>G: POST /uploads (x-api-key)
  G->>A: invoke
  A-->>B: presigned PUT (key, size, type locked; 300 s)
  B->>S: PUT PDF (direct, never via Next.js)
  B->>N: POST /api/claims {form + documentKey}
  N->>G: POST /claims
  G->>A: invoke
  A->>S: GET bytes 0-4 (exists? %PDF-? size?)
  A->>D: PutItem if not exists (claimId from upload ID)
  A-->>B: 201 claim (processing: pending), or 200 if replayed
  D-->>P: stream INSERT
  P->>D: lock pending → processing (conditional)
  P->>D: ADD usage counter (conditional cap)
  P->>S: GetObject PDF
  P->>M: Converse Nova Lite (PDF) → fields + quotes
  P->>P: rule checks (policy / date / amount)
  P->>M: Converse Nova Micro → explanation + "fits incident?"
  P->>D: save result (only if it still owns the lock)
  B->>N: claim page auto-refresh
  N->>G: GET /claims/{id}
  G->>A: invoke
  A-->>B: claim + customer-safe processing result
```

## Why it's shaped this way

| Decision | Reason |
|---|---|
| PDF goes browser → S3 with a presigned URL | Keeps documents off the web server; the URL allows one key, one size, one type, for 5 minutes. |
| Next.js server holds the API key | The browser never sees an AWS credential or the API key (`import "server-only"`). |
| REST API (not HTTP API) | API keys and usage plans give a hard daily quota as a cost guard. |
| SigV4 written by hand | Project rule: no AWS SDK. Verified against AWS-published signing examples. |
| Claim ID derived from the upload ID | One upload can only ever create one claim; identical retries return the stored claim. |
| DynamoDB Streams → separate processor | Processing starts only after the claim is saved; Lambda reads of the stream are free; the API stays fast. |
| Bedrock instead of Textract | Textract is denied on this Free-plan account by an AWS-managed service control policy (verified). |
| Rules decide; models only extract and explain | Deterministic comparisons; the model can never approve, reject or call fraud. |
