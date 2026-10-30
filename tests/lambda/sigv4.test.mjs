// AWS Signature Version 4 — checked against the examples AWS publishes in the S3 SigV4 docs
// ("Examples: Signature calculations", credentials AKIAIOSFODNN7EXAMPLE). No AWS SDK involved.
import assert from "node:assert/strict";
import { test } from "node:test";

Object.assign(process.env, { AWS_REGION: "ap-southeast-2", BUCKET_NAME: "b", TABLE_NAME: "t" });
const api = await import("../../aws/lambda/claimpilot-api/index.mjs");
const processor = await import("../../aws/lambda/claimpilot-processor/index.mjs");

const credentials = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };
const now = new Date("2013-05-24T00:00:00Z");
const host = "examplebucket.s3.amazonaws.com";
const sig = (headers) => /Signature=([0-9a-f]+)/.exec(headers.authorization)[1];

const GET_VECTOR = "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41";
const PUT_VECTOR = "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd";
const PUT_HEADERS = { date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" };

test("claims API signer: GET object with Range header", () => {
  const h = api.signRequest({ method: "GET", service: "s3", host, path: "/test.txt", headers: { range: "bytes=0-9" }, region: "us-east-1", credentials, now });
  assert.equal(sig(h), GET_VECTOR);
});

test("claims API signer: PUT object (path with '$', body hash)", () => {
  const h = api.signRequest({ method: "PUT", service: "s3", host, path: "/test$file.text", body: "Welcome to Amazon S3.", headers: PUT_HEADERS, region: "us-east-1", credentials, now });
  assert.equal(sig(h), PUT_VECTOR);
});

test("claims API signer: presigned URL", () => {
  const url = api.presignUrl({ method: "GET", host, path: "/test.txt", expiresIn: 86400, region: "us-east-1", credentials, now });
  assert.equal(new URL(url).searchParams.get("X-Amz-Signature"), "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
});

test("processor signer: same S3 vectors (path passed pre-encoded)", () => {
  const get = processor.signRequest({ method: "GET", service: "s3", host, encodedPath: "/test.txt", headers: { range: "bytes=0-9" }, region: "us-east-1", credentials, now });
  assert.equal(sig(get), GET_VECTOR);
  const put = processor.signRequest({ method: "PUT", service: "s3", host, encodedPath: "/test%24file.text", body: "Welcome to Amazon S3.", headers: PUT_HEADERS, region: "us-east-1", credentials, now });
  assert.equal(sig(put), PUT_VECTOR);
});

test("processor signer: non-S3 services encode the path a second time (Bedrock model IDs contain ':')", () => {
  const args = { method: "POST", service: "bedrock", host: "bedrock-runtime.ap-southeast-2.amazonaws.com", body: "{}", region: "ap-southeast-2", credentials, now };
  const a = processor.signRequest({ ...args, encodedPath: "/model/apac.amazon.nova-lite-v1%3A0/converse" });
  const b = processor.signRequest({ ...args, encodedPath: "/model/apac.amazon.nova-lite-v1:0/converse" });
  assert.notEqual(sig(a), sig(b)); // the canonical URI differs ("%253A" vs ":")
});
