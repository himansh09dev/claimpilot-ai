#!/usr/bin/env node
// ClaimPilot AI — end-to-end tests against the REAL deployed AWS stack (no AWS SDK, no mocks).
//
//   node --env-file=.env.local scripts/e2e.mjs                    # safe checks only (no claims created, no AI calls)
//   node --env-file=.env.local scripts/e2e.mjs --with-processing  # + 2 real claims → Bedrock processing (uses credits)
//
// Talks to API Gateway with the server-side API key (never printed) and uploads fictional test PDFs
// from docs/test-documents/ to S3 through presigned URLs, exactly as the browser does.

import { readFileSync } from "node:fs";

const BASE = process.env.CLAIMS_API_URL?.replace(/\/+$/, "");
const KEY = process.env.CLAIMS_API_KEY;
const WITH_PROCESSING = process.argv.includes("--with-processing");
const POLL_TIMEOUT_MS = 120_000;

if (!BASE || !KEY) {
  console.error("Set CLAIMS_API_URL and CLAIMS_API_KEY (e.g. run with --env-file=.env.local).");
  process.exit(2);
}

const docs = new URL("../docs/test-documents/", import.meta.url);
const pdf = (name) => readFileSync(new URL(name, docs));
const results = [];

async function api(method, path, body, { key = KEY } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(key && { "x-api-key": key }) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, requestId: res.headers.get("x-amzn-requestid") };
}

async function check(name, fn) {
  const started = Date.now();
  try {
    const evidence = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, evidence });
    console.log(`✔ ${name}${evidence ? `  — ${evidence}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - started, error: err.message });
    console.log(`✖ ${name}\n    ${err.message}`);
  }
}

function expect(cond, message) {
  if (!cond) throw new Error(message);
}

async function uploadPdf(bytes, name) {
  const auth = await api("POST", "/uploads", { fileName: name, contentType: "application/pdf", sizeBytes: bytes.length });
  expect(auth.status === 200, `POST /uploads → ${auth.status}`);
  const put = await fetch(auth.json.uploadUrl, { method: "PUT", headers: auth.json.headers, body: bytes });
  expect(put.status === 200, `S3 PUT → ${put.status}`);
  return auth.json.documentKey;
}

async function waitForProcessing(id) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const r = await api("GET", `/claims/${id}`);
    const status = r.json?.processing?.status;
    if (status && status !== "pending" && status !== "processing") return r.json;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`processing did not finish within ${POLL_TIMEOUT_MS / 1000}s`);
}

const claimFor = (documentKey, overrides = {}) => ({
  policyNumber: "CP-12345678",
  incidentDate: "2026-10-28",
  category: "home",
  amount: 980,
  description: "[E2E TEST] Water leaked from the flat upstairs and damaged our kitchen ceiling; it needed plaster and paint.",
  documentKey,
  documentName: "e2e-invoice.pdf",
  ...overrides,
});

console.log(`ClaimPilot E2E — ${new Date().toISOString()} — ${WITH_PROCESSING ? "full run (with AI processing)" : "safe checks only"}\n`);

/* ---------------- Safe checks: no claims created, no AI calls ---------------- */

await check("API rejects requests without the API key (403)", async () => {
  const r = await api("GET", "/claims", undefined, { key: null });
  expect(r.status === 403, `expected 403, got ${r.status}`);
});

await check("GET /claims returns real records from DynamoDB", async () => {
  const r = await api("GET", "/claims");
  expect(r.status === 200 && Array.isArray(r.json?.claims), `expected 200 + claims[], got ${r.status}`);
  expect(r.json.claims.every((c) => /^CLM-[0-9A-F]{12}$/.test(c.id)), "unexpected item in claim list");
  return `${r.json.claims.length} claims, request ${r.requestId}`;
});

await check("Unknown claim → 404 with a friendly message", async () => {
  const r = await api("GET", "/claims/CLM-000000000000");
  expect(r.status === 404 && r.json?.error?.code === "not_found", `got ${r.status}`);
});

await check("Invalid claim data → 400 with field errors", async () => {
  const r = await api("POST", "/claims", { policyNumber: "X", incidentDate: "2099-01-01", category: "boat", amount: -5, description: "short", documentKey: "x", documentName: "x" });
  expect(r.status === 400, `expected 400, got ${r.status}`);
  return `fields: ${Object.keys(r.json.error.fieldErrors).join(", ")}`;
});

await check("Malformed body → 400", async () => {
  const r = await api("POST", "/claims", "not json");
  expect(r.status === 400, `expected 400, got ${r.status}`);
});

await check("Claim referring to a document that was never uploaded → 422", async () => {
  const r = await api("POST", "/claims", claimFor("uploads/00000000-0000-4000-8000-000000000000.pdf"));
  expect(r.status === 422 && r.json?.error?.code === "document_missing", `got ${r.status} ${r.json?.error?.code}`);
});

await check("Non-PDF upload request → 400", async () => {
  const r = await api("POST", "/uploads", { fileName: "x.exe", contentType: "application/pdf", sizeBytes: 10 });
  expect(r.status === 400, `expected 400, got ${r.status}`);
});

await check("Presigned URL rejects a different size and a different type; bucket is private", async () => {
  const bytes = pdf("1-matching-invoice.pdf");
  const auth = await api("POST", "/uploads", { fileName: "x.pdf", contentType: "application/pdf", sizeBytes: bytes.length });
  expect(auth.status === 200, `POST /uploads → ${auth.status}`);
  const wrongSize = await fetch(auth.json.uploadUrl, { method: "PUT", headers: auth.json.headers, body: Buffer.concat([bytes, Buffer.from("x")]) });
  expect(wrongSize.status === 403, `wrong size → ${wrongSize.status}`);
  const wrongType = await fetch(auth.json.uploadUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: bytes });
  expect(wrongType.status === 403, `wrong type → ${wrongType.status}`);
  const publicRead = await fetch(auth.json.uploadUrl.split("?")[0]);
  expect(publicRead.status === 403, `unsigned read → ${publicRead.status}`);
  return "403 / 403 / 403 (no object was stored)";
});

/* ---------------- Full flow: creates real test claims, triggers Bedrock ---------------- */

if (WITH_PROCESSING) {
  let created;

  await check("Submit: presigned upload → direct S3 PUT → claim saved in DynamoDB (201)", async () => {
    const documentKey = await uploadPdf(pdf("1-matching-invoice.pdf"), "e2e-invoice.pdf");
    const r = await api("POST", "/claims", claimFor(documentKey));
    expect(r.status === 201, `expected 201, got ${r.status} ${JSON.stringify(r.json?.error)}`);
    expect(r.json.processing?.status === "pending", "new claim should start with processing pending");
    created = { id: r.json.id, documentKey };
    return `${r.json.id}, request ${r.requestId}`;
  });

  await check("Repeated identical submission returns the same claim (200), no duplicate", async () => {
    expect(created, "no claim from the previous step");
    const r = await api("POST", "/claims", claimFor(created.documentKey));
    expect(r.status === 200 && r.json.id === created.id, `expected 200 + ${created.id}, got ${r.status} ${r.json?.id}`);
    const changed = await api("POST", "/claims", claimFor(created.documentKey, { amount: 981 }));
    expect(changed.status === 409, `changed details should be 409, got ${changed.status}`);
    const list = await api("GET", "/claims");
    const copies = list.json.claims.filter((c) => c.id === created.id).length;
    expect(copies === 1, `expected exactly 1 stored copy, found ${copies}`);
  });

  await check("Processing runs once and the result is retrievable (matching invoice → no conflicts)", async () => {
    expect(created, "no claim from the previous step");
    const claim = await waitForProcessing(created.id);
    const p = claim.processing;
    expect(p.status === "completed", `status ${p.status} ${JSON.stringify(p.error)}`);
    expect(p.assessment.checks.slice(0, 3).every((c) => c.result === "match"), `checks ${p.assessment.checks.map((c) => c.result)}`);
    expect(p.extraction.requestId && p.ai.requestId, "missing Bedrock request IDs");
    const timelineChecks = claim.timeline.filter((t) => t.title.startsWith("Automated document check")).length;
    expect(timelineChecks === 1, `expected one check in the timeline, found ${timelineChecks}`);
    return `${p.assessment.recommendation} · fits incident: ${p.ai.descriptionMatchesDocument} · Nova Lite ${p.extraction.requestId} (${p.extraction.inputTokens}/${p.extraction.outputTokens} tok) · Nova Micro ${p.ai.requestId} (${p.ai.inputTokens}/${p.ai.outputTokens} tok)`;
  });

  await check("Mismatched invoice → discrepancies listed and flagged for human review", async () => {
    const documentKey = await uploadPdf(pdf("2-mismatched-invoice.pdf"), "e2e-mismatch.pdf");
    const r = await api("POST", "/claims", claimFor(documentKey));
    expect(r.status === 201, `submit → ${r.status}`);
    const p = (await waitForProcessing(r.json.id)).processing;
    expect(p.assessment?.recommendation === "needs_human_review", `recommendation ${p.assessment?.recommendation}`);
    expect(p.assessment.inconsistencies.length >= 2, `inconsistencies ${p.assessment.inconsistencies.length}`);
    return `${r.json.id} · ${p.assessment.inconsistencies.length} inconsistencies`;
  });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ""}`);
process.exitCode = failed ? 1 : 0;
