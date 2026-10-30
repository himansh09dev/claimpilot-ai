"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, controlClasses } from "@/components/ui/FormField";
import { CLAIM_CATEGORIES, type ClaimFormField } from "@/lib/claims/types";
import {
  DESCRIPTION_MAX,
  earliestIncidentDate,
  todayIsoDate,
} from "@/lib/claims/validation";
import { FileUploadField } from "./FileUploadField";
import { useClaimForm, type SubmitState } from "./useClaimForm";

const FIELD_ORDER: { field: ClaimFormField; label: string }[] = [
  { field: "policyNumber", label: "Policy number" },
  { field: "incidentDate", label: "Incident date" },
  { field: "category", label: "Claim category" },
  { field: "amount", label: "Claim amount" },
  { field: "description", label: "Description" },
  { field: "document", label: "Supporting document" },
];

/** Button label for each step of the real submission flow. */
function submittingLabel(state: SubmitState): string {
  if (state.phase !== "submitting" || !state.progress) return "Checking your claim…";
  switch (state.progress.stage) {
    case "authorizing":
      return "Preparing secure upload…";
    case "uploading":
      return `Uploading PDF… ${state.progress.percent}%`;
    case "saving":
      return "Saving your claim…";
  }
}

const noopSubscribe = () => () => {};

/**
 * Date limits depend on the user's local clock, so read them on the client only.
 * Returning `undefined` on the server avoids a hydration mismatch near midnight.
 */
function useDateLimits() {
  const max = useSyncExternalStore(noopSubscribe, () => todayIsoDate(), () => undefined);
  const min = useSyncExternalStore(noopSubscribe, () => earliestIncidentDate(), () => undefined);
  return { min, max };
}

export function ClaimForm() {
  const { values, errors, submitState, setValue, setDocument, handleBlur, submit, reset } =
    useClaimForm();
  const { min, max } = useDateLimits();
  const summaryRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const isSubmitting = submitState.phase === "submitting";
  const errorEntries = FIELD_ORDER.filter(({ field }) => errors[field]);

  // Move focus to feedback after submit so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (submitState.phase === "invalid") summaryRef.current?.focus();
    if (["submitted", "not_connected", "error"].includes(submitState.phase)) {
      resultRef.current?.focus();
    }
  }, [submitState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-describedby="form-required-note" className="space-y-6">
      {submitState.phase === "invalid" && errorEntries.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="error-summary-title"
          className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950"
        >
          <h2 id="error-summary-title" className="font-semibold">
            Please fix {errorEntries.length === 1 ? "1 problem" : `${errorEntries.length} problems`} before continuing
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorEntries.map(({ field, label }) => (
              <li key={field}>
                <a href={`#${field}`} className="underline underline-offset-2 hover:text-rose-800">
                  {label}: {errors[field]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitState.phase === "submitted" && (
        <Alert ref={resultRef} tabIndex={-1} tone="success" role="alert" title={`Claim ${submitState.claim.id} submitted`}>
          <p>
            Your claim and supporting PDF were received and stored. Its current status is
            &ldquo;Received&rdquo;, and an automated document check runs next.{" "}
            <Link href={`/claims/${submitState.claim.id}`} className="font-medium underline underline-offset-2">
              View claim {submitState.claim.id}
            </Link>
          </p>
        </Alert>
      )}

      {submitState.phase === "not_connected" && (
        <Alert ref={resultRef} tabIndex={-1} tone="warning" role="alert" title="Your claim has not been submitted">
          <p>
            Your details passed all checks in this browser, but the claims service isn&apos;t
            available right now, so nothing was sent and your PDF was not uploaded.
          </p>
        </Alert>
      )}

      {submitState.phase === "error" && (
        <Alert ref={resultRef} tabIndex={-1} tone="danger" role="alert" title="We couldn’t submit your claim">
          <p>{submitState.message}</p>
          <p className="mt-1">
            Your entries are still below. Trying again is safe: an already-uploaded document isn&apos;t
            uploaded twice, and the same claim is never saved twice.
          </p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={() => void submit()}>
            Try again
          </Button>
        </Alert>
      )}

      <Card className="p-5 sm:p-6">
        <fieldset disabled={isSubmitting} className="space-y-6">
          <legend className="text-base font-semibold text-slate-900">Policy &amp; incident</legend>
          <p id="form-required-note" className="-mt-4 text-sm text-slate-500">
            Fields marked <span className="text-rose-600" aria-hidden="true">*</span>
            <span className="sr-only">with an asterisk</span> are required.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              id="policyNumber"
              label="Policy number"
              hint="Found on your policy card, e.g. CP-12345678."
              error={errors.policyNumber}
              required
            >
              {(control) => (
                <input
                  {...control}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="CP-12345678"
                  value={values.policyNumber}
                  onChange={(e) => setValue("policyNumber", e.target.value)}
                  onBlur={() => handleBlur("policyNumber")}
                  className={controlClasses(Boolean(errors.policyNumber), "h-10 font-mono uppercase placeholder:normal-case")}
                />
              )}
            </FormField>

            <FormField
              id="incidentDate"
              label="Incident date"
              hint="When did it happen? Must be within the last year."
              error={errors.incidentDate}
              required
            >
              {(control) => (
                <input
                  {...control}
                  type="date"
                  min={min}
                  max={max}
                  value={values.incidentDate}
                  onChange={(e) => setValue("incidentDate", e.target.value)}
                  onBlur={() => handleBlur("incidentDate")}
                  className={controlClasses(Boolean(errors.incidentDate), "h-10")}
                />
              )}
            </FormField>

            <FormField id="category" label="Claim category" error={errors.category} required>
              {(control) => (
                <select
                  {...control}
                  value={values.category}
                  onChange={(e) => setValue("category", e.target.value as typeof values.category)}
                  onBlur={() => handleBlur("category")}
                  className={controlClasses(Boolean(errors.category), "h-10")}
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {CLAIM_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="amount"
              label="Claim amount (USD)"
              hint="Total amount you are claiming, up to $250,000."
              error={errors.amount}
              required
            >
              {(control) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500" aria-hidden="true">
                    $
                  </span>
                  <input
                    {...control}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={values.amount}
                    onChange={(e) => setValue("amount", e.target.value.replace(/[,\s$]/g, ""))}
                    onBlur={() => handleBlur("amount")}
                    className={controlClasses(Boolean(errors.amount), "h-10 pl-7 tabular-nums")}
                  />
                </div>
              )}
            </FormField>
          </div>

          <FormField
            id="description"
            label="What happened?"
            hint="Describe the incident, the damage or loss, and anyone involved."
            error={errors.description}
            required
            footer={
              <span
                className={
                  values.description.length > DESCRIPTION_MAX
                    ? "shrink-0 text-xs font-medium text-rose-700"
                    : "shrink-0 text-xs text-slate-500"
                }
              >
                {values.description.length.toLocaleString()} / {DESCRIPTION_MAX.toLocaleString()}
              </span>
            }
          >
            {(control) => (
              <textarea
                {...control}
                rows={5}
                value={values.description}
                onChange={(e) => setValue("description", e.target.value)}
                onBlur={() => handleBlur("description")}
                className={controlClasses(Boolean(errors.description), "py-2")}
              />
            )}
          </FormField>

          <FormField
            id="document"
            label="Supporting document"
            hint="Attach a receipt, invoice, police report or estimate as a single PDF."
            error={errors.document}
            required
          >
            {(control) => (
              <FileUploadField
                {...control}
                file={values.document}
                onFileChange={(file) => void setDocument(file)}
                disabled={isSubmitting}
              />
            )}
          </FormField>
        </fieldset>
      </Card>

      <p className="sr-only" aria-live="polite">
        {isSubmitting ? submittingLabel(submitState) : ""}
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={reset} disabled={isSubmitting}>
          Clear form
        </Button>
        <Button type="submit" loading={isSubmitting} loadingText={submittingLabel(submitState)}>
          Submit claim
        </Button>
      </div>
    </form>
  );
}
