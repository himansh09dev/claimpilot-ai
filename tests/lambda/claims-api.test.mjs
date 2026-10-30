// claimpilot-api Lambda — offline unit tests. AWS responses are replaced by an in-test fetch stub;
// the deployed function is exercised for real by scripts/e2e.mjs.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

Object.assign(process.env, {
  AWS_REGION: "ap-southeast-2", BUCKET_NAME: "claim-pilot", TABLE_NAME: "claimpilots-claim",
  AWS_ACCESS_KEY_ID: "ASIATEST", AWS_SECRET_ACCESS_KEY: "secret", AWS_SESSION_TOKEN: "token/with+chars=",
});

let s3, dynamo, calls;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes(".s3.")) return s3();
  return dynamo(init.headers["x-amz-target"].split(".")[1], JSON.parse(init.body));
};
const { handler } = await import("../../aws/lambda/claimpilot-api/index.mjs");

const call = async (httpMethod, resource, body, pathParameters) => {
  const r = await handler({ httpMethod, resource, body: body === undefined ? undefined : JSON.stringify(body), pathParameters }, { awsRequestId: "t" });
  return { status: r.statusCode, body: JSON.parse(r.body) };
};
const ddbError = (type) => new Response(JSON.stringify({ __type: `com.amazonaws.dynamodb.v20120810#${type}` }), { status: 400 });
const pdfHead = () => new Response("%PDF-", { status: 206, headers: { "content-range": "bytes 0-4/1234", "content-type": "application/pdf" } });
const today = new Date().toISOString().slice(0, 10);
const documentKey = "uploads/0f8a6b3c-1d2e-4f50-9a1b-2c3d4e5f6a7b.pdf";
const claimBody = {
  policyNumber: "cp-12345678", incidentDate: today, category: "home", amount: 980,
  description: "Water leaked from the flat upstairs and damaged the ceiling.", documentKey, documentName: "invoice.pdf",
};

beforeEach(() => {
  calls = [];
  s3 = pdfHead;
  dynamo = () => new Response("{}");
});

test("POST /uploads returns a presigned PUT locked to type, size and a server-chosen key", async () => {
  const r = await call("POST", "/uploads", { fileName: "a.pdf", contentType: "application/pdf", sizeBytes: 1234 });
  assert.equal(r.status, 200);
  const u = new URL(r.body.uploadUrl);
  assert.equal(u.host, "claim-pilot.s3.ap-southeast-2.amazonaws.com");
  assert.equal(u.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
  assert.equal(u.searchParams.get("X-Amz-Expires"), "300");
  assert.match(r.body.documentKey, /^uploads\/[0-9a-f-]{36}\.pdf$/);
});

test("POST /uploads rejects non-PDFs, oversize files and bad bodies", async () => {
  assert.equal((await call("POST", "/uploads", { fileName: "a.exe", contentType: "application/pdf", sizeBytes: 5 })).status, 400);
  assert.equal((await call("POST", "/uploads", { fileName: "a.pdf", contentType: "application/pdf", sizeBytes: 11 * 1024 * 1024 })).status, 400);
  assert.equal((await call("POST", "/uploads")).status, 400);
});

test("POST /claims validates every field", async () => {
  const r = await call("POST", "/claims", { policyNumber: "x", incidentDate: "2026-02-31", category: "boat", amount: 1.234, description: "short", documentKey: "../etc" });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.body.error.fieldErrors).sort(), ["amount", "category", "description", "document", "incidentDate", "policyNumber"]);
});

test("POST /claims checks the upload in S3 before saving", async () => {
  s3 = () => new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 });
  assert.equal((await call("POST", "/claims", claimBody)).body.error.code, "document_missing");
  s3 = () => new Response("hello", { status: 206, headers: { "content-range": "bytes 0-4/1234", "content-type": "application/pdf" } });
  assert.equal((await call("POST", "/claims", claimBody)).body.error.code, "document_invalid");
});

test("POST /claims stores the claim with a pending document check", async () => {
  let item;
  dynamo = (action, p) => { assert.equal(action, "PutItem"); assert.equal(p.ConditionExpression, "attribute_not_exists(claimId)"); item = p.Item; return new Response("{}"); };
  const r = await call("POST", "/claims", claimBody);
  assert.equal(r.status, 201);
  assert.equal(r.body.id, "CLM-0F8A6B3C1D2E");
  assert.equal(r.body.policyNumber, "CP-12345678");
  assert.equal(r.body.processing.status, "pending");
  assert.equal(item.processing.M.status.S, "pending");
});

test("repeated identical submission returns the stored claim (200), never a duplicate", async () => {
  let stored;
  dynamo = (action, p) => {
    if (action === "PutItem") { if (stored) return ddbError("ConditionalCheckFailedException"); stored = p.Item; return new Response("{}"); }
    if (action === "GetItem") return new Response(JSON.stringify({ Item: stored }));
  };
  const first = await call("POST", "/claims", claimBody);
  const replay = await call("POST", "/claims", claimBody);
  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.id, first.body.id);
  const changed = await call("POST", "/claims", { ...claimBody, amount: 999 });
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error.code, "duplicate_claim");
});

test("GET /claims hides the usage counter; GET /claims/{id} handles unknown IDs", async () => {
  const item = { claimId: { S: "CLM-0F8A6B3C1D2E" }, policyNumber: { S: "CP-12345678" }, createdAt: { S: "2026-10-29T00:00:00Z" }, amount: { N: "980" }, status: { S: "received" } };
  dynamo = () => new Response(JSON.stringify({ Items: [item, { claimId: { S: "USAGE#2026-10" }, processedCount: { N: "3" } }] }));
  const list = await call("GET", "/claims");
  assert.deepEqual(list.body.claims.map((c) => c.id), ["CLM-0F8A6B3C1D2E"]);
  dynamo = () => new Response("{}");
  assert.equal((await call("GET", "/claims/{claimId}", undefined, { claimId: "CLM-FFFFFFFFFFFF" })).status, 404);
  assert.equal((await call("GET", "/claims/{claimId}", undefined, { claimId: "../x" })).status, 404);
});

test("customers never see raw AWS error types or text", async () => {
  const processing = { M: { status: { S: "failed" }, error: { M: {
    code: { S: "extraction_not_permitted" }, message: { S: "Friendly message." },
    evidence: { M: { service: { S: "Amazon Bedrock" }, requestId: { S: "req-1" }, awsType: { S: "AccessDeniedException" }, detail: { S: "arn:aws:organizations::123:policy/secret" } } },
  } } } };
  dynamo = () => new Response(JSON.stringify({ Item: { claimId: { S: "CLM-0F8A6B3C1D2E" }, processing } }));
  const r = await call("GET", "/claims/{claimId}", undefined, { claimId: "CLM-0F8A6B3C1D2E" });
  assert.deepEqual(r.body.processing.error, { code: "extraction_not_permitted", message: "Friendly message.", evidence: { service: "Amazon Bedrock", requestId: "req-1" } });
  assert.ok(!JSON.stringify(r.body).includes("arn:aws"));
});

test("unexpected AWS failures become generic 500/503 responses", async () => {
  dynamo = () => ddbError("ProvisionedThroughputExceededException");
  assert.equal((await call("GET", "/claims")).status, 503);
  dynamo = () => ddbError("AccessDeniedException");
  const r = await call("GET", "/claims");
  assert.equal(r.status, 500);
  assert.equal(r.body.error.message, "Something went wrong on our side. Please try again.");
  assert.equal((await call("DELETE", "/claims")).status, 404);
});
