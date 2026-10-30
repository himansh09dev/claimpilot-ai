"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { FieldControlProps } from "@/components/ui/FormField";
import { formatFileSize } from "@/lib/claims/format";

interface FileUploadFieldProps extends FieldControlProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

/**
 * PDF picker with drag-and-drop.
 *
 * The selected File object lives only in React state (in memory) for this tab.
 * Nothing is uploaded or written to disk. In Phase 2 the file will be sent
 * directly from the browser to Amazon S3 using a presigned URL.
 */
export function FileUploadField({
  file,
  onFileChange,
  disabled = false,
  ...control
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Keep the native input in sync when the parent clears the file (e.g. "Clear form"),
  // otherwise re-selecting the same file wouldn't fire a change event.
  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
  }, [file]);

  function clear() {
    onFileChange(null);
    inputRef.current?.focus();
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFileChange(dropped);
  }

  const invalid = control["aria-invalid"];

  return (
    <div className="space-y-3">
      <label
        htmlFor={control.id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600",
          isDragging && "border-brand-500 bg-brand-50",
          !isDragging && invalid && "border-rose-400 bg-rose-50/40",
          !isDragging && !invalid && "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-white",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <svg className="size-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <span className="mt-2 text-sm font-medium text-slate-800">
          <span className="text-brand-700 underline underline-offset-2">Choose a PDF</span> or drag it here
        </span>
        <span className="mt-1 text-xs text-slate-500">PDF only, up to 10 MB</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          {...control}
        />
      </label>

      <div aria-live="polite">
        {file && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-rose-50 text-xs font-semibold text-rose-700" aria-hidden="true">
                PDF
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(file.size)} · held in this browser tab only, not uploaded
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clear} disabled={disabled} aria-label={`Remove ${file.name}`}>
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
