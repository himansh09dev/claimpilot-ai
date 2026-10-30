import { createClaim } from "@/lib/claims/claims-service";
import type { ClaimCategory } from "@/lib/claims/types";
import { badRequest, readJsonObject, respond } from "../_lib/respond";

/**
 * POST /api/claims — forwards claim metadata to the claims API.
 * Only known fields are forwarded; full validation happens in the Lambda.
 */
export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return badRequest();

  const result = await createClaim({
    policyNumber: String(body.policyNumber ?? ""),
    incidentDate: String(body.incidentDate ?? ""),
    category: String(body.category ?? "") as ClaimCategory,
    amount: Number(body.amount),
    description: String(body.description ?? ""),
    documentKey: String(body.documentKey ?? ""),
    documentName: String(body.documentName ?? ""),
  });
  return respond(result, 201);
}
