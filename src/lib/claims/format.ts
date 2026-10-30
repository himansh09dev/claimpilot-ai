import { CLAIM_CATEGORIES, type ClaimCategory, type ClaimStatus } from "./types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(amount: number): string {
  return currency.format(amount);
}

/** Formats a YYYY-MM-DD date without time-zone drift (parsed as UTC, shown as UTC). */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

export function formatDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(isoTimestamp));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function categoryLabel(category: ClaimCategory): string {
  return CLAIM_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export const STATUS_META: Record<
  ClaimStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  received: { label: "Received", tone: "neutral" },
  in_review: { label: "In review", tone: "info" },
  needs_info: { label: "Needs info", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};
