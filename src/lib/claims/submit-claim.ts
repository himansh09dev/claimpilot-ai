import {
  isApiErrorBody,
  type CreateClaimRequest,
  type ServiceResult,
  type UploadAuthorization,
} from "./api-contract";
import type { Claim, ClaimDraft } from "./types";

/**
 * Browser-side submission flow (3 steps):
 *
 *   1. POST /api/uploads   → Next.js server → API Gateway → Lambda returns a presigned S3 URL
 *   2. PUT  <presigned URL> → the PDF goes DIRECTLY from the browser to the private S3 bucket
 *   3. POST /api/claims    → Lambda checks the object in S3, then writes the claim to DynamoDB
 *
 * Success is reported only when step 3 returns the stored claim.
 *
 * Retry safety: once the PDF is in S3, its key is reported through `onUploaded`. A retry passes
 * it back as `previousUpload`, so steps 1–2 are skipped and the same document key is re-sent.
 * The API derives the claim ID from that key, so a replayed submission returns the existing
 * claim instead of creating a duplicate.
 */

export interface CompletedUpload {
  file: File;
  documentKey: string;
}

export type SubmitProgress =
  | { stage: "authorizing" }
  | { stage: "uploading"; percent: number }
  | { stage: "saving" };

async function postJson<T>(url: string, body: unknown): Promise<ServiceResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "error", code: "network_error", message: "You appear to be offline. Check your connection and try again." };
  }
  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return { status: "ok", data: data as T };
  if (isApiErrorBody(data)) {
    if (data.error.code === "not_connected") return { status: "not_connected" };
    return { status: "error", ...data.error };
  }
  return { status: "error", code: `http_${res.status}`, message: "Something went wrong. Please try again." };
}

/** Uses XMLHttpRequest (not fetch) because it reports upload progress. */
function putToS3(
  auth: UploadAuthorization,
  file: File,
  onProgress: (percent: number) => void,
): Promise<ServiceResult<null>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", auth.uploadUrl);
    for (const [name, value] of Object.entries(auth.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ status: "ok", data: null });
      // S3 returns 403 for an expired URL or a size/type that doesn't match the signature.
      resolve({
        status: "error",
        code: "upload_rejected",
        message: "Your document upload was rejected. Please attach the PDF again and resubmit.",
      });
    };
    xhr.onerror = () =>
      resolve({
        status: "error",
        code: "upload_failed",
        message: "Your document couldn’t be uploaded. Check your connection and try again.",
      });
    xhr.send(file);
  });
}

export async function submitClaim(
  draft: ClaimDraft,
  onProgress: (progress: SubmitProgress) => void,
  options: { previousUpload?: CompletedUpload | null; onUploaded?: (upload: CompletedUpload) => void } = {},
): Promise<ServiceResult<Claim>> {
  let documentKey: string;
  if (options.previousUpload && options.previousUpload.file === draft.document) {
    documentKey = options.previousUpload.documentKey; // already in S3 — don't upload again
  } else {
    onProgress({ stage: "authorizing" });
    const auth = await postJson<UploadAuthorization>("/api/uploads", {
      fileName: draft.document.name,
      contentType: "application/pdf",
      sizeBytes: draft.document.size,
    });
    if (auth.status !== "ok") return auth;

    onProgress({ stage: "uploading", percent: 0 });
    const upload = await putToS3(auth.data, draft.document, (percent) =>
      onProgress({ stage: "uploading", percent }),
    );
    if (upload.status !== "ok") return upload;
    documentKey = auth.data.documentKey;
    options.onUploaded?.({ file: draft.document, documentKey });
  }

  onProgress({ stage: "saving" });
  const request: CreateClaimRequest = {
    policyNumber: draft.policyNumber,
    incidentDate: draft.incidentDate,
    category: draft.category,
    amount: draft.amount,
    description: draft.description,
    documentKey,
    documentName: draft.document.name,
  };
  return postJson<Claim>("/api/claims", request);
}
