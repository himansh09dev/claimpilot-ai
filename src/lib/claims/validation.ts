import {
  CLAIM_CATEGORIES,
  type ClaimCategory,
  type ClaimDraft,
  type ClaimFormErrors,
  type ClaimFormField,
  type ClaimFormValues,
} from "./types";

/**
 * Pure validation functions — no React, no I/O — so they are easy to unit test
 * and can be reused by the API layer in Phase 2.
 */

export const POLICY_NUMBER_PATTERN = /^CP-\d{8}$/;
export const MAX_CLAIM_AMOUNT = 250_000;
export const DESCRIPTION_MIN = 30;
export const DESCRIPTION_MAX = 2000;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_INCIDENT_AGE_DAYS = 365;

const categoryValues = new Set<string>(CLAIM_CATEGORIES.map((c) => c.value));

function isClaimCategory(value: string): value is ClaimCategory {
  return categoryValues.has(value);
}

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayIsoDate(now: Date = new Date()): string {
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function earliestIncidentDate(now: Date = new Date()): string {
  const earliest = new Date(now);
  earliest.setDate(earliest.getDate() - MAX_INCIDENT_AGE_DAYS);
  return todayIsoDate(earliest);
}

type FieldValidator<K extends ClaimFormField> = (
  value: ClaimFormValues[K],
  now: Date,
) => string | undefined;

const validators: { [K in ClaimFormField]: FieldValidator<K> } = {
  policyNumber(value) {
    const v = value.trim().toUpperCase();
    if (!v) return "Enter your policy number.";
    if (!POLICY_NUMBER_PATTERN.test(v)) {
      return "Policy number must look like CP-12345678 (CP- followed by 8 digits).";
    }
  },

  incidentDate(value, now) {
    if (!value) return "Enter the date of the incident.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      return "Enter a valid date.";
    }
    // YYYY-MM-DD strings compare correctly as plain strings.
    if (value > todayIsoDate(now)) return "Incident date can’t be in the future.";
    if (value < earliestIncidentDate(now)) {
      return `Claims must be filed within ${MAX_INCIDENT_AGE_DAYS} days of the incident.`;
    }
  },

  category(value) {
    if (!value) return "Choose a claim category.";
    if (!isClaimCategory(value)) return "Choose a valid claim category.";
  },

  amount(value) {
    const v = value.trim();
    if (!v) return "Enter the claim amount.";
    if (!/^\d+(\.\d{1,2})?$/.test(v)) {
      return "Enter an amount in dollars, e.g. 1250 or 1250.50.";
    }
    const n = Number(v);
    if (n <= 0) return "Amount must be greater than $0.";
    if (n > MAX_CLAIM_AMOUNT) {
      return `Online claims are limited to $${MAX_CLAIM_AMOUNT.toLocaleString("en-US")}.`;
    }
  },

  description(value) {
    const length = value.trim().length;
    if (length === 0) return "Describe what happened.";
    if (length < DESCRIPTION_MIN) {
      return `Add a little more detail (at least ${DESCRIPTION_MIN} characters).`;
    }
    if (length > DESCRIPTION_MAX) {
      return `Keep the description under ${DESCRIPTION_MAX} characters.`;
    }
  },

  document(file) {
    if (!file) return "Attach a supporting PDF document.";
    const looksLikePdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) return "Only PDF files are accepted.";
    if (file.size === 0) return "This file is empty.";
    if (file.size > MAX_DOCUMENT_BYTES) return "PDF must be 10 MB or smaller.";
  },
};

export function validateField<K extends ClaimFormField>(
  field: K,
  values: ClaimFormValues,
  now: Date = new Date(),
): string | undefined {
  return validateFieldValue(field, values[field], now);
}

/** Every rule depends only on its own field's value, so it can be checked in isolation. */
export function validateFieldValue<K extends ClaimFormField>(
  field: K,
  value: ClaimFormValues[K],
  now: Date = new Date(),
): string | undefined {
  return validators[field](value, now);
}

export function validateClaimForm(
  values: ClaimFormValues,
  now: Date = new Date(),
): ClaimFormErrors {
  const errors: ClaimFormErrors = {};
  for (const field of Object.keys(validators) as ClaimFormField[]) {
    const message = validateField(field, values, now);
    if (message) errors[field] = message;
  }
  return errors;
}

/**
 * Validates and converts raw form strings into a typed draft.
 * Returns either the draft or the field errors — never both.
 */
export function toClaimDraft(
  values: ClaimFormValues,
  now: Date = new Date(),
): { ok: true; draft: ClaimDraft } | { ok: false; errors: ClaimFormErrors } {
  const errors = validateClaimForm(values, now);
  if (Object.keys(errors).length > 0 || !values.document || !values.category) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    draft: {
      policyNumber: values.policyNumber.trim().toUpperCase(),
      incidentDate: values.incidentDate,
      category: values.category,
      amount: Number(values.amount.trim()),
      description: values.description.trim(),
      document: values.document,
    },
  };
}

/**
 * Checks the file's first bytes for the PDF signature ("%PDF-").
 * Reads 5 bytes into memory only — nothing is written anywhere.
 */
export async function hasPdfSignature(file: File): Promise<boolean> {
  const header = await file.slice(0, 5).text();
  return header === "%PDF-";
}
