import { NextResponse } from "next/server";
import type { ServiceResult } from "@/lib/claims/api-contract";

/** Converts a server-side ServiceResult into the JSON response the browser receives. */
export function respond<T>(
  result: ServiceResult<T> & { httpStatus?: number },
  successStatus = 200,
): NextResponse {
  const headers = { "cache-control": "no-store" };
  switch (result.status) {
    case "ok":
      return NextResponse.json(result.data, { status: successStatus, headers });
    case "not_connected":
      return NextResponse.json(
        { error: { code: "not_connected", message: "The claims service isn’t available right now." } },
        { status: 503, headers },
      );
    case "error": {
      // Pass client errors (400/404/409/422/429) through; anything else is a bad gateway.
      const status = result.httpStatus && result.httpStatus < 500 && result.httpStatus !== 403 ? result.httpStatus : 502;
      const { code = "upstream_error", message, fieldErrors } = result;
      return NextResponse.json({ error: { code, message, fieldErrors } }, { status, headers });
    }
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

export function badRequest(message = "Request body must be a JSON object.") {
  return NextResponse.json({ error: { code: "invalid_body", message } }, { status: 400 });
}
