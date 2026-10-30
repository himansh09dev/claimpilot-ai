import "server-only";
import { connection } from "next/server";
import {
  isApiErrorBody,
  type CreateClaimRequest,
  type ListClaimsResponse,
  type ServiceResult,
  type UploadAuthorization,
  type UploadAuthorizationRequest,
} from "./api-contract";
import type { Claim } from "./types";

/**
 * Server-only client for the ClaimPilot claims API (API Gateway → Lambda → DynamoDB/S3).
 *
 * - `import "server-only"` makes the build fail if a client component imports this,
 *   so CLAIMS_API_KEY can never end up in the browser bundle.
 * - No AWS SDK and no AWS credentials here: API Gateway is called over plain HTTPS
 *   with an API key that identifies this web server (and is rate-limited by a usage plan).
 * - If the env vars are missing, every call reports "not_connected" (same as Phase 1).
 */

const REQUEST_TIMEOUT_MS = 10_000;

function config() {
  const baseUrl = process.env.CLAIMS_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.CLAIMS_API_KEY;
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

export function isClaimsApiConfigured(): boolean {
  return config() !== null;
}

async function callClaimsApi<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<ServiceResult<T> & { httpStatus?: number }> {
  // Always render claims data per request — never bake it into a static page.
  await connection();

  const cfg = config();
  if (!cfg) return { status: "not_connected" };

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method: init.method,
      headers: { "content-type": "application/json", "x-api-key": cfg.apiKey },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[claims-api] ${init.method} ${path} failed:`, err);
    return { status: "error", code: "network_error", message: "We couldn’t reach the claims service." };
  }

  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return { status: "ok", data: body as T, httpStatus: res.status };

  if (isApiErrorBody(body)) {
    return { status: "error", httpStatus: res.status, ...body.error };
  }
  // Errors produced by API Gateway itself (bad key, throttling) have a different shape.
  // Details go to the server log only; users get a plain message.
  console.error(`[claims-api] ${init.method} ${path} → HTTP ${res.status}`, body);
  const message =
    res.status === 429
      ? "Too many requests right now. Please wait a minute and try again."
      : "The claims service is temporarily unavailable. Please try again shortly.";
  return { status: "error", httpStatus: res.status, code: `http_${res.status}`, message };
}

export async function listSubmittedClaims(): Promise<ServiceResult<Claim[]>> {
  const result = await callClaimsApi<ListClaimsResponse>("/claims");
  return result.status === "ok" ? { status: "ok", data: result.data.claims } : result;
}

/** Resolves `ok` with `null` when the claim doesn't exist. */
export async function getSubmittedClaim(id: string): Promise<ServiceResult<Claim | null>> {
  const result = await callClaimsApi<Claim>(`/claims/${encodeURIComponent(id)}`);
  if (result.status === "error" && result.httpStatus === 404) return { status: "ok", data: null };
  return result;
}

export function requestUploadAuthorization(input: UploadAuthorizationRequest) {
  return callClaimsApi<UploadAuthorization>("/uploads", { method: "POST", body: input });
}

/** Resolves `ok` only after the API has verified the PDF in S3 and stored the claim in DynamoDB. */
export function createClaim(input: CreateClaimRequest) {
  return callClaimsApi<Claim>("/claims", { method: "POST", body: input });
}
