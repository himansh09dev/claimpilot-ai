"use client";

import { useCallback, useRef, useState } from "react";
import { submitClaim, type CompletedUpload, type SubmitProgress } from "@/lib/claims/submit-claim";
import type { Claim, ClaimFormErrors, ClaimFormField, ClaimFormValues } from "@/lib/claims/types";
import { hasPdfSignature, toClaimDraft, validateField, validateFieldValue } from "@/lib/claims/validation";

const INITIAL_VALUES: ClaimFormValues = {
  policyNumber: "",
  incidentDate: "",
  category: "",
  amount: "",
  description: "",
  document: null,
};

const NOT_A_PDF = "This file doesn’t appear to be a valid PDF.";

/**
 * Submission lifecycle. "submitted" is only reached when the claims API returns
 * the claim it stored in DynamoDB — never optimistically.
 */
export type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting"; progress: SubmitProgress | null }
  | { phase: "invalid" }
  | { phase: "submitted"; claim: Claim }
  | { phase: "not_connected" }
  | { phase: "error"; message: string };

/**
 * Form state for the new-claim form.
 *
 * Validation strategy:
 * - a field is validated when it loses focus (blur), not on every keystroke;
 * - once a field shows an error, it re-validates as the user types, so the
 *   error disappears as soon as it's fixed;
 * - submit validates everything and focuses the error summary.
 */
export function useClaimForm() {
  const [values, setValues] = useState<ClaimFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<ClaimFormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: "idle" });
  // Guards against a slow PDF check finishing after the user picked another file.
  const latestFile = useRef<File | null>(null);
  // The PDF already uploaded for this form (in memory only), so a retry doesn't upload it again.
  const completedUpload = useRef<CompletedUpload | null>(null);

  const setFieldError = useCallback((field: ClaimFormField, message: string | undefined) => {
    setErrors((prev) => {
      if (prev[field] === message) return prev;
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }, []);

  const setValue = useCallback(
    <K extends ClaimFormField>(field: K, value: ClaimFormValues[K]) => {
      // Functional updates: each change builds on the latest state, even when several
      // changes happen before React re-renders.
      setValues((prev) => ({ ...prev, [field]: value }));
      // Re-validate live only if the field is already showing an error.
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const message = validateFieldValue(field, value);
        const next = { ...prev };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
      setSubmitState((s) => (s.phase === "idle" ? s : { phase: "idle" }));
    },
    [],
  );

  const handleBlur = useCallback(
    (field: ClaimFormField) => {
      setFieldError(field, validateField(field, values));
    },
    [setFieldError, values],
  );

  /** Selecting a file validates it immediately (type, size, then PDF signature). */
  const setDocument = useCallback(
    async (file: File | null) => {
      latestFile.current = file;
      setValue("document", file);
      const message = validateFieldValue("document", file);
      setFieldError("document", message);
      if (file && !message && !(await hasPdfSignature(file))) {
        if (latestFile.current === file) setFieldError("document", NOT_A_PDF);
      }
    },
    [setFieldError, setValue],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    setSubmitState({ phase: "submitting", progress: null });

    const result = toClaimDraft(values);
    const syncErrors = result.ok ? {} : result.errors;
    // The PDF signature check is async, so it runs here alongside the sync rules.
    const documentIsFake =
      values.document !== null &&
      !syncErrors.document &&
      !(await hasPdfSignature(values.document));

    if (!result.ok || documentIsFake) {
      setErrors(documentIsFake ? { ...syncErrors, document: NOT_A_PDF } : syncErrors);
      setSubmitState({ phase: "invalid" });
      return false;
    }

    const response = await submitClaim(
      result.draft,
      (progress) => setSubmitState({ phase: "submitting", progress }),
      {
        previousUpload: completedUpload.current,
        onUploaded: (upload) => {
          completedUpload.current = upload;
        },
      },
    );
    switch (response.status) {
      case "ok":
        latestFile.current = null;
        completedUpload.current = null;
        setValues(INITIAL_VALUES);
        setErrors({});
        setSubmitState({ phase: "submitted", claim: response.data });
        return true;
      case "not_connected":
        setSubmitState({ phase: "not_connected" });
        return false;
      case "error":
        // Server-side validation errors map back onto the same form fields.
        if (response.fieldErrors && Object.keys(response.fieldErrors).length > 0) {
          setErrors(response.fieldErrors);
          setSubmitState({ phase: "invalid" });
        } else {
          setSubmitState({ phase: "error", message: response.message });
        }
        return false;
    }
  }, [values]);

  const reset = useCallback(() => {
    latestFile.current = null;
    completedUpload.current = null;
    setValues(INITIAL_VALUES);
    setErrors({});
    setSubmitState({ phase: "idle" });
  }, []);

  return { values, errors, submitState, setValue, setDocument, handleBlur, submit, reset };
}
