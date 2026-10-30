import type { ReactNode } from "react";
import { cn } from "./cn";

/** Props every form control needs to be correctly wired to its label, hint and error. */
export interface FieldControlProps {
  id: string;
  name: string;
  required: boolean;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}

interface FormFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Extra content under the control, e.g. a character counter. */
  footer?: ReactNode;
  /** Render prop: receives the accessibility props to spread onto the control. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Renders label + control + hint + error with correct a11y wiring:
 * `htmlFor`/`id`, `aria-describedby` (hint and error) and `aria-invalid`.
 */
export function FormField({ id, label, hint, error, required = false, footer, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="text-rose-600" aria-hidden="true"> *</span>
        ) : (
          <span className="font-normal text-slate-500"> (optional)</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
      {children({
        id,
        name: id,
        required,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}
      {(error || footer) && (
        <div className="flex items-start justify-between gap-3">
          {error ? (
            <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-rose-700">
              <svg className="mt-0.5 size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          ) : (
            <span />
          )}
          {footer}
        </div>
      )}
    </div>
  );
}

export function controlClasses(invalid: boolean, extra?: string) {
  return cn(
    "block w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400",
    "focus:outline-2 focus:outline-offset-0 disabled:bg-slate-100",
    invalid
      ? "border-rose-400 focus:border-rose-500 focus:outline-rose-500"
      : "border-slate-300 focus:border-brand-500 focus:outline-brand-500",
    extra,
  );
}
