// ClaimPilot AI — claims API (AWS Lambda, Node.js 22.x+, ES module, handler: index.handler)
//
// Paste this file into the Lambda console as `index.mjs`. It has NO dependencies:
// - no AWS SDK — calls to S3 and DynamoDB are plain HTTPS requests signed with
//   AWS Signature Version 4 (SigV4) using node:crypto;
// - credentials are the Lambda execution role's TEMPORARY credentials, which the
//   Lambda runtime provides as environment variables. They never leave this function,
//   except the session token inside a presigned URL (standard AWS presigning).
//
// Routes (API Gateway REST API, Lambda proxy integration):
//   POST /uploads             → short-lived presigned S3 PUT URL for one PDF
//   POST /claims              → verify the uploaded PDF in S3, then store the claim
//   GET  /claims              → list claims
//   GET  /claims/{claimId}    → one claim
//
// Phase 3: new claims are stored with `processing.status = "pending"`. The separate
// claimpilot-processor Lambda (DynamoDB Streams trigger) fills in the document check.

import { createHash, createHmac, randomUUID } from "node:crypto";

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.BUCKET_NAME;
const TABLE = process.env.TABLE_NAME;

const S3_HOST = `${BUCKET}.s3.${REGION}.amazonaws.com`;
const DYNAMODB_HOST = `dynamodb.${REGION}.amazonaws.com`;

// Keep these rules in sync with src/lib/claims/validation.ts in the web app.
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 300;
const POLICY_NUMBER_PATTERN = /^CP-\d{8}$/;
const CATEGORIES = new Set(["auto", "home", "health", "travel", "theft", "liability"]);
const MAX_CLAIM_AMOUNT = 250_000;
const DESCRIPTION_MIN = 30;
const DESCRIPTION_MAX = 2000;
const MAX_INCIDENT_AGE_DAYS = 365;
const DOCUMENT_KEY_PATTERN =
  /^uploads\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.pdf$/;
const CLAIM_ID_PATTERN = /^CLM-[0-9A-F]{12}$/;
const LIST_LIMIT = 100;
const AWS_TIMEOUT_MS = 5000;

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export const handler = async (event, context) => {
  const route = `${event.httpMethod} ${event.resource}`;
  try {
    switch (route) {
      case "POST /uploads":
        return json(200, createUploadAuthorization(parseBody(event)));
      case "POST /claims": {
        // 201 = created; 200 = the same submission was replayed (retry after a lost response).
        const { claim, replayed } = await createClaim(parseBody(event));
        return json(replayed ? 200 : 201, claim);
      }
      case "GET /claims":
        return json(200, await listClaims());
      case "GET /claims/{claimId}":
        return json(200, await getClaim(event.pathParameters?.claimId));
      default:
        throw new HttpError(404, "not_found", "Route not found.");
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return json(err.statusCode, {
        error: { code: err.code, message: err.message, ...(err.fieldErrors && { fieldErrors: err.fieldErrors }) },
      });
    }
    // Log only technical details — never claim contents.
    console.error(
      JSON.stringify({ requestId: context?.awsRequestId, route, error: err.message, awsType: err.awsType }),
    );
    if (err.awsType === "ProvisionedThroughputExceededException") {
      return json(503, { error: { code: "busy", message: "The claims service is busy. Please try again in a moment." } });
    }
    return json(500, { error: { code: "internal_error", message: "Something went wrong on our side. Please try again." } });
  }
};

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

function createUploadAuthorization(body) {
  const { fileName, contentType, sizeBytes } = body;
  let problem;
  if (typeof fileName !== "string" || fileName.length > 200 || !fileName.toLowerCase().endsWith(".pdf")) {
    problem = "Only PDF files are accepted.";
  } else if (contentType !== "application/pdf") {
    problem = "Only PDF files are accepted.";
  } else if (!Number.isInteger(sizeBytes) || sizeBytes < 1) {
    problem = "This file is empty.";
  } else if (sizeBytes > MAX_DOCUMENT_BYTES) {
    problem = "PDF must be 10 MB or smaller.";
  }
  if (problem) throw new HttpError(400, "validation_failed", problem, { document: problem });

  // The server picks the object key; the browser can't choose where it writes.
  const documentKey = `uploads/${randomUUID()}.pdf`;
  const uploadUrl = presignUrl({
    method: "PUT",
    host: S3_HOST,
    path: `/${documentKey}`,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    // Signed headers: S3 rejects the upload if the browser sends a different type or size.
    headers: { "content-type": "application/pdf", "content-length": String(sizeBytes) },
  });

  return {
    uploadUrl,
    documentKey,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    headers: { "Content-Type": "application/pdf" },
  };
}

async function createClaim(body) {
  const input = validateClaimInput(body, Date.now());

  // Don't trust the browser's word that the upload worked — check S3 directly.
  const upload = await inspectUploadedDocument(input.documentKey);
  if (!upload.exists) {
    const message = "We couldn’t find your uploaded document. Please attach it again.";
    throw new HttpError(422, "document_missing", message, { document: message });
  }
  if (upload.size > MAX_DOCUMENT_BYTES || upload.contentType !== "application/pdf" || !upload.isPdf) {
    const message = "The uploaded file isn’t a valid PDF.";
    throw new HttpError(422, "document_invalid", message, { document: message });
  }

  // Claim ID is derived from the random upload ID, so one upload can only ever
  // create one claim (a double-click or retry can't create duplicates).
  const uploadId = DOCUMENT_KEY_PATTERN.exec(input.documentKey)[1];
  const now = new Date().toISOString();
  const item = {
    claimId: `CLM-${uploadId.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    policyNumber: input.policyNumber,
    incidentDate: input.incidentDate,
    category: input.category,
    amount: input.amount,
    description: input.description,
    status: "received",
    createdAt: now,
    documentKey: input.documentKey,
    documentName: input.documentName,
    documentSizeBytes: upload.size,
    timeline: [
      { at: now, title: "Claim received" },
      {
        at: now,
        title: "Supporting document received",
        detail: "PDF stored privately in Amazon S3; file type and size checked.",
      },
    ],
    // Picked up by claimpilot-processor via DynamoDB Streams.
    processing: { status: "pending", requestedAt: now },
  };

  try {
    await dynamodb("PutItem", {
      TableName: TABLE,
      Item: marshalItem(item),
      ConditionExpression: "attribute_not_exists(claimId)",
    });
  } catch (err) {
    if (err.awsType !== "ConditionalCheckFailedException") throw err;
    // Idempotent retry: the claim ID comes from the upload ID, so an existing item means this
    // upload was already used. Identical details = a retried submission → return the stored claim.
    const existing = await dynamodb("GetItem", { TableName: TABLE, Key: { claimId: { S: item.claimId } } });
    const stored = existing.Item ? unmarshalItem(existing.Item) : null;
    if (stored && isSameSubmission(stored, item)) return { claim: toClaimDto(stored), replayed: true };
    throw new HttpError(409, "duplicate_claim", "This document was already used for a different claim. Attach it again to file a new claim.");
  }

  return { claim: toClaimDto(item), replayed: false };
}

async function listClaims() {
  // Scan is fine for a small demo table. A multi-user version would use a
  // per-user partition key and Query instead.
  const result = await dynamodb("Scan", { TableName: TABLE, Limit: LIST_LIMIT });
  const claims = (result.Items ?? [])
    .map(unmarshalItem)
    // The table also holds the processor's monthly usage counter ("USAGE#YYYY-MM").
    .filter((item) => CLAIM_ID_PATTERN.test(item.claimId))
    .map(toClaimDto);
  claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { claims };
}

async function getClaim(claimId) {
  if (typeof claimId !== "string" || !CLAIM_ID_PATTERN.test(claimId)) {
    throw new HttpError(404, "not_found", "Claim not found.");
  }
  const result = await dynamodb("GetItem", { TableName: TABLE, Key: { claimId: { S: claimId } } });
  if (!result.Item) throw new HttpError(404, "not_found", "Claim not found.");
  return toClaimDto(unmarshalItem(result.Item));
}

function isSameSubmission(a, b) {
  return ["policyNumber", "incidentDate", "category", "amount", "description", "documentKey"].every((k) => a[k] === b[k]);
}

/**
 * Customer-facing view of the automated check. AWS error types and raw AWS error text stay in
 * DynamoDB and CloudWatch for operators; customers only see the friendly message and request ID.
 */
function publicProcessing(processing) {
  if (!processing || typeof processing !== "object") return null;
  const { error, ...rest } = processing;
  if (!error) return { ...rest, error: error ?? null };
  const evidence = error.evidence
    ? { service: error.evidence.service, requestId: error.evidence.requestId ?? null }
    : undefined;
  return { ...rest, error: { code: error.code, message: error.message, ...(evidence && { evidence }) } };
}

function toClaimDto(item) {
  return {
    id: item.claimId,
    origin: "submitted",
    policyNumber: item.policyNumber,
    incidentDate: item.incidentDate,
    category: item.category,
    amount: item.amount,
    description: item.description,
    status: item.status,
    createdAt: item.createdAt,
    document: item.documentName ? { fileName: item.documentName, sizeBytes: item.documentSizeBytes ?? 0 } : null,
    timeline: Array.isArray(item.timeline) ? item.timeline : [],
    processing: publicProcessing(item.processing),
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validateClaimInput(body, nowMs) {
  const errors = {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");

  const policyNumber = str(body.policyNumber).toUpperCase();
  if (!POLICY_NUMBER_PATTERN.test(policyNumber)) {
    errors.policyNumber = "Policy number must look like CP-12345678.";
  }

  const incidentDate = str(body.incidentDate);
  const isRealDate =
    /^\d{4}-\d{2}-\d{2}$/.test(incidentDate) &&
    !Number.isNaN(Date.parse(`${incidentDate}T00:00:00Z`)) &&
    new Date(`${incidentDate}T00:00:00Z`).toISOString().slice(0, 10) === incidentDate;
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  // One day of slack each way: the user's local "today" can differ from UTC.
  if (!isRealDate) errors.incidentDate = "Enter a valid date.";
  else if (incidentDate > day(nowMs + 86_400_000)) errors.incidentDate = "Incident date can’t be in the future.";
  else if (incidentDate < day(nowMs - (MAX_INCIDENT_AGE_DAYS + 1) * 86_400_000)) {
    errors.incidentDate = `Claims must be filed within ${MAX_INCIDENT_AGE_DAYS} days of the incident.`;
  }

  const category = str(body.category);
  if (!CATEGORIES.has(category)) errors.category = "Choose a valid claim category.";

  const amount = body.amount;
  const hasTwoDecimalsAtMost =
    typeof amount === "number" && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || !hasTwoDecimalsAtMost) {
    errors.amount = "Enter an amount greater than $0 with at most 2 decimals.";
  } else if (amount > MAX_CLAIM_AMOUNT) {
    errors.amount = "Online claims are limited to $250,000.";
  }

  const description = str(body.description);
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} characters.`;
  }

  const documentKey = str(body.documentKey);
  // Keep only safe display characters from the original file name.
  const documentName = str(body.documentName).replace(/[^\w .()-]/g, "_").slice(0, 200);
  if (!DOCUMENT_KEY_PATTERN.test(documentKey) || !documentName) {
    errors.document = "Attach a supporting PDF document.";
  }

  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, "validation_failed", "Please fix the highlighted fields.", errors);
  }
  return { policyNumber, incidentDate, category, amount, description, documentKey, documentName };
}

/* ------------------------------------------------------------------ */
/* S3 + DynamoDB over HTTPS (no SDK)                                   */
/* ------------------------------------------------------------------ */

/** Reads only the first 5 bytes of the object: proves it exists, gives its size and PDF signature. */
async function inspectUploadedDocument(key) {
  const res = await signedFetch({
    method: "GET",
    service: "s3",
    host: S3_HOST,
    path: `/${key}`,
    headers: { range: "bytes=0-4" },
  });
  // Without s3:ListBucket permission, S3 answers 403 (not 404) for a missing key.
  if (res.status === 404 || res.status === 403) {
    await res.body?.cancel();
    return { exists: false };
  }
  if (res.status === 416) return { exists: true, size: 0, contentType: null, isPdf: false };
  if (res.status !== 206 && res.status !== 200) {
    throw awsError(`S3 GetObject returned ${res.status}`, await res.text());
  }
  const totalFromRange = res.headers.get("content-range")?.split("/")[1];
  const size = Number(totalFromRange ?? res.headers.get("content-length"));
  const head = Buffer.from(await res.arrayBuffer()).toString("latin1");
  return { exists: true, size, contentType: res.headers.get("content-type"), isPdf: head.startsWith("%PDF-") };
}

async function dynamodb(action, payload) {
  const res = await signedFetch({
    method: "POST",
    service: "dynamodb",
    host: DYNAMODB_HOST,
    path: "/",
    headers: {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": `DynamoDB_20120810.${action}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw awsError(`DynamoDB ${action} returned ${res.status}`, text);
  return text ? JSON.parse(text) : {};
}

function awsError(message, responseText) {
  const err = new Error(message);
  try {
    const parsed = JSON.parse(responseText);
    err.awsType = String(parsed.__type ?? "").split("#").pop();
  } catch {
    err.awsType = /<Code>([^<]+)<\/Code>/.exec(responseText ?? "")?.[1];
  }
  return err;
}

async function signedFetch({ method, service, host, path, headers = {}, body = "" }) {
  const signed = signRequest({ method, service, host, path, headers, body, region: REGION });
  return fetch(`https://${host}${encodePath(path)}`, {
    method,
    headers: signed,
    body: method === "GET" || method === "HEAD" ? undefined : body,
    signal: AbortSignal.timeout(AWS_TIMEOUT_MS),
  });
}

/* ------------------------------------------------------------------ */
/* DynamoDB attribute-value (un)marshalling                            */
/* ------------------------------------------------------------------ */

function marshal(value) {
  if (value === null) return { NULL: true };
  if (typeof value === "string") return { S: value };
  if (typeof value === "number") return { N: String(value) };
  if (typeof value === "boolean") return { BOOL: value };
  if (Array.isArray(value)) return { L: value.map(marshal) };
  return {
    M: Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, marshal(v)]),
    ),
  };
}

function unmarshal(attr) {
  if ("S" in attr) return attr.S;
  if ("N" in attr) return Number(attr.N);
  if ("BOOL" in attr) return attr.BOOL;
  if ("NULL" in attr) return null;
  if ("L" in attr) return attr.L.map(unmarshal);
  if ("M" in attr) return unmarshalItem(attr.M);
  return undefined;
}

const marshalItem = (obj) => marshal(obj).M;
const unmarshalItem = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, unmarshal(v)]));

/* ------------------------------------------------------------------ */
/* AWS Signature Version 4                                             */
/* https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html */
/* ------------------------------------------------------------------ */

function envCredentials() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  };
}

const sha256Hex = (data) => createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data, "utf8").digest();

/** RFC 3986 encoding, as SigV4 requires (encodeURIComponent leaves !'()* unescaped). */
const rfc3986 = (s) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Encodes each path segment but keeps the "/" separators. */
const encodePath = (path) => path.split("/").map(rfc3986).join("/");

function amzDates(now) {
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20260101T120000Z
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function canonicalQueryString(params) {
  return Object.entries(params)
    .map(([k, v]) => [rfc3986(k), rfc3986(String(v))])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function canonicalHeaders(headers) {
  const entries = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, " ")])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    canonical: entries.map(([k, v]) => `${k}:${v}\n`).join(""),
    signedHeaders: entries.map(([k]) => k).join(";"),
  };
}

function signature({ secretAccessKey, dateStamp, region, service, stringToSign }) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  return createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
}

/** Header-based signing. Returns the full set of headers to send (including Authorization). */
export function signRequest({
  method,
  service,
  host,
  path,
  query = {},
  headers = {},
  body = "",
  region,
  credentials = envCredentials(),
  now = new Date(),
}) {
  const { amzDate, dateStamp } = amzDates(now);
  const payloadHash = sha256Hex(body);
  const allHeaders = { ...headers, host, "x-amz-date": amzDate };
  if (service === "s3") allHeaders["x-amz-content-sha256"] = payloadHash;
  if (credentials.sessionToken) allHeaders["x-amz-security-token"] = credentials.sessionToken;

  const { canonical, signedHeaders } = canonicalHeaders(allHeaders);
  const canonicalRequest = [
    method,
    encodePath(path),
    canonicalQueryString(query),
    canonical,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const sig = signature({ secretAccessKey: credentials.secretAccessKey, dateStamp, region, service, stringToSign });

  const sendHeaders = { ...allHeaders };
  delete sendHeaders.host; // fetch sets Host itself (same value)
  return {
    ...sendHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
  };
}

/** Query-string signing (a "presigned URL"). The payload is not signed (UNSIGNED-PAYLOAD). */
export function presignUrl({
  method,
  host,
  path,
  expiresIn,
  headers = {},
  region = REGION,
  service = "s3",
  credentials = envCredentials(),
  now = new Date(),
}) {
  const { amzDate, dateStamp } = amzDates(now);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const { canonical, signedHeaders } = canonicalHeaders({ ...headers, host });
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${credentials.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  if (credentials.sessionToken) query["X-Amz-Security-Token"] = credentials.sessionToken;

  const canonicalQuery = canonicalQueryString(query);
  const canonicalRequest = [method, encodePath(path), canonicalQuery, canonical, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const sig = signature({ secretAccessKey: credentials.secretAccessKey, dateStamp, region, service, stringToSign });

  return `https://${host}${encodePath(path)}?${canonicalQuery}&X-Amz-Signature=${sig}`;
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(statusCode, code, message, fieldErrors) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) throw new HttpError(400, "invalid_body", "Request body is required.");
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch {
    // fall through
  }
  throw new HttpError(400, "invalid_body", "Request body must be a JSON object.");
}
