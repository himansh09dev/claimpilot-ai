/**
 * Domain types shared by the claim form, claims list and claim details page.
 *
 * `origin` is the key to keeping preview data separate from real data:
 * - "preview"   → fictional sample claims bundled with the UI (src/lib/preview)
 * - "submitted" → claims confirmed by the real claims service (Phase 2, AWS)
 */

export const CLAIM_CATEGORIES = [
  { value: "auto", label: "Auto / Vehicle" },
  { value: "home", label: "Home & Property" },
  { value: "health", label: "Health & Medical" },
  { value: "travel", label: "Travel" },
  { value: "theft", label: "Theft & Loss" },
  { value: "liability", label: "Personal Liability" },
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number]["value"];

export const CLAIM_STATUSES = [
  "received",
  "in_review",
  "needs_info",
  "approved",
  "rejected",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type ClaimOrigin = "preview" | "submitted";

export interface ClaimDocument {
  fileName: string;
  sizeBytes: number;
}

export interface ClaimTimelineEvent {
  at: string; // ISO 8601 timestamp
  title: string;
  detail?: string;
}

/* ---------------- Phase 3: automated document check ---------------- */

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "completed_without_ai"
  | "failed"
  | "skipped";

export interface ExtractedField {
  value: string;
  /** Exact text from the document where the model found the value. */
  quote?: string;
  /** False when the model reported the value as hard to read or ambiguous. */
  clear?: boolean;
  /** Calibrated confidence (0–100) when the extractor provides one; null for model extraction. */
  confidence: number | null;
}

export interface FieldCheck {
  field: string;
  label: string;
  claimValue: string | null;
  documentValue: string | null;
  confidence: number | null;
  result: "match" | "mismatch" | "not_found" | "low_confidence" | "unparsed" | "info";
  note?: string;
}

export interface ProcessingError {
  code: string;
  message: string;
  /** Customer-safe evidence only. AWS error types and raw messages stay in DynamoDB/CloudWatch. */
  evidence?: { service: string; requestId: string | null };
}

/** Written by the claimpilot-processor Lambda. Never a final decision. */
export interface ClaimProcessing {
  status: ProcessingStatus;
  requestedAt?: string;
  startedAt?: string;
  completedAt?: string;
  error?: ProcessingError | null;
  extraction?: {
    service: string;
    api: string;
    modelId?: string;
    requestId: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    pages: number | null;
    documentType?: string;
    fields: Record<string, ExtractedField | null>;
  } | null;
  ai?: {
    service: string;
    modelId?: string;
    status: "ok" | "failed";
    requestId?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs?: number | null;
    documentType?: string;
    descriptionMatchesDocument?: "yes" | "no" | "unclear";
    additionalConcerns?: string[];
    questionsForClaimant?: string[];
    error?: { code: string; message: string };
  } | null;
  assessment?: {
    checks: FieldCheck[];
    missingInformation: string[];
    inconsistencies: string[];
    explanation: string;
    explanationSource: "bedrock" | "rules";
    recommendation: "ready_for_review" | "needs_human_review";
    reasons: string[];
  } | null;
}

export interface Claim {
  id: string;
  origin: ClaimOrigin;
  policyNumber: string;
  incidentDate: string; // YYYY-MM-DD
  category: ClaimCategory;
  amount: number; // in USD
  description: string;
  status: ClaimStatus;
  createdAt: string; // ISO 8601 timestamp
  document: ClaimDocument | null;
  timeline: ClaimTimelineEvent[];
  /** Only on real submitted claims created after Phase 3. */
  processing?: ClaimProcessing | null;
}

/** Raw values held by the form while the user is typing. Everything is a string (or File). */
export interface ClaimFormValues {
  policyNumber: string;
  incidentDate: string;
  category: ClaimCategory | "";
  amount: string;
  description: string;
  document: File | null;
}

export type ClaimFormField = keyof ClaimFormValues;

export type ClaimFormErrors = Partial<Record<ClaimFormField, string>>;

/** Parsed, validated payload — what will be sent to the claims API in Phase 2. */
export interface ClaimDraft {
  policyNumber: string;
  incidentDate: string;
  category: ClaimCategory;
  amount: number;
  description: string;
  document: File;
}
