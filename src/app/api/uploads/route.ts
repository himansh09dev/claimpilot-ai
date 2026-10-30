import { requestUploadAuthorization } from "@/lib/claims/claims-service";
import { badRequest, readJsonObject, respond } from "../_lib/respond";

/**
 * POST /api/uploads — asks the claims API for a presigned S3 upload URL.
 * Only file metadata passes through here; the PDF itself goes from the browser
 * straight to S3 and never touches this server.
 */
export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return badRequest();

  const result = await requestUploadAuthorization({
    fileName: String(body.fileName ?? ""),
    contentType: "application/pdf",
    sizeBytes: Number(body.sizeBytes),
  });
  return respond(result);
}
