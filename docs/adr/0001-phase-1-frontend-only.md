# ADR 0001 — Phase 1 is a frontend-only portal with an explicit "not connected" service

**Status:** Accepted · 2026-10-27

## Context
Phase 1 must deliver a polished claims portal UI without any backend, persistence or AWS code.
The UI must never claim a claim was submitted or verified until a real AWS integration confirms it.

## Decision
- Single Next.js App Router app (TypeScript, Tailwind CSS v4). No API routes, no storage.
- All data access goes through one interface, `ClaimsService` (`src/lib/claims/claims-service.ts`).
  The Phase 1 implementation returns `{ status: "not_connected" }` for every call. It is not a mock:
  it never fakes success or returns fake data.
- Fictional sample claims live only in `src/lib/preview/`, have `origin: "preview"` and `PRV-` IDs,
  and are always rendered in separate, labeled "Preview data" sections.
- The selected PDF is kept only as a `File` object in React state. It is never uploaded or written to disk.
- Validation rules are pure functions (`src/lib/claims/validation.ts`) so the Phase 2 API can reuse them.

## Consequences
- Phase 2 swaps in a real `ClaimsService` (API + S3 presigned upload) without changing UI components.
- Until then, valid submissions show a "Your claim has not been submitted" warning.
