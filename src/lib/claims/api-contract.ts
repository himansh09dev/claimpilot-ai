import type { Claim, ClaimCategory, ClaimFormErrors } from "./types";

/**
 * Request/response shapes shared by the browser, the Next.js route handlers and
 * the Lambda claims API (aws/lambda/claimpilot-api/index.mjs). Types only — safe
 * to import from client and server code.
 */

export type ServiceResult<T> =
  | { status: "ok"; data: T }
  /** The claims API isn't configured for this environment (no URL/key). */
  | { status: "not_connected" }
  | { status: "error"; message: string; code?: string; fieldErrors?: ClaimFormErrors };

/** POST /uploads */
export interface UploadAuthorizationRequest {
  fileName: string;
  contentType: "application/pdf";
  sizeBytes: number;
}

export interface UploadAuthorization {
  /** Presigned S3 PUT URL — valid for one object, one size, one content type, a few minutes. */
  uploadUrl: string;
  documentKey: string;
  expiresInSeconds: number;
  /** Headers the browser must send with the PUT (they are part of the signature). */
  headers: Record<string, string>;
}

/** POST /claims */
export interface CreateClaimRequest {
  policyNumber: string;
  incidentDate: string;
  category: ClaimCategory;
  amount: number;
  description: string;
  documentKey: string;
  documentName: string;
}

/** GET /claims */
export interface ListClaimsResponse {
  claims: Claim[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; fieldErrors?: ClaimFormErrors };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorBody).error?.message === "string"
  );
}
