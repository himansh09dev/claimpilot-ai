import type { Claim } from "@/lib/claims/types";

/**
 * FICTIONAL SAMPLE CLAIMS — for UI previews only.
 *
 * - Every record has `origin: "preview"` and an ID starting with "PRV-".
 * - Names, policy numbers and amounts are invented; they do not belong to anyone.
 * - These are never mixed into "submitted claims", which only ever come from
 *   the claims API (src/lib/claims/claims-service.ts).
 */

export const PREVIEW_ID_PREFIX = "PRV-";

export function isPreviewClaimId(id: string): boolean {
  return id.toUpperCase().startsWith(PREVIEW_ID_PREFIX);
}

const SAMPLE_CLAIMS: readonly Claim[] = [
  {
    id: "PRV-1048",
    origin: "preview",
    policyNumber: "CP-40218837",
    incidentDate: "2026-10-12",
    category: "auto",
    amount: 3840.5,
    description:
      "Rear-ended at a red light on Maple Avenue. Rear bumper and tail light assembly damaged. Police report filed at the scene; repair estimate from an approved body shop attached.",
    status: "in_review",
    createdAt: "2026-10-13T09:24:00Z",
    document: { fileName: "repair-estimate-maple-ave.pdf", sizeBytes: 412_880 },
    timeline: [
      { at: "2026-10-13T09:24:00Z", title: "Claim received" },
      {
        at: "2026-10-13T09:25:00Z",
        title: "Document checks passed",
        detail: "PDF readable, policy number matches policy record.",
      },
      {
        at: "2026-10-14T15:02:00Z",
        title: "Assigned for review",
        detail: "Repair estimate is being compared with regional labor rates.",
      },
    ],
  },
  {
    id: "PRV-1047",
    origin: "preview",
    policyNumber: "CP-77310295",
    incidentDate: "2026-09-28",
    category: "home",
    amount: 12_600,
    description:
      "Burst pipe under the kitchen sink flooded the kitchen and part of the hallway overnight. Flooring and lower cabinets need replacement; plumber invoice and contractor quote included.",
    status: "needs_info",
    createdAt: "2026-09-30T18:41:00Z",
    document: { fileName: "plumber-invoice-and-quote.pdf", sizeBytes: 1_284_096 },
    timeline: [
      { at: "2026-09-30T18:41:00Z", title: "Claim received" },
      { at: "2026-09-30T18:42:00Z", title: "Document checks passed" },
      {
        at: "2026-10-03T11:10:00Z",
        title: "More information requested",
        detail: "Please add photos of the damaged flooring taken before repairs began.",
      },
    ],
  },
  {
    id: "PRV-1045",
    origin: "preview",
    policyNumber: "CP-15592046",
    incidentDate: "2026-09-02",
    category: "travel",
    amount: 960,
    description:
      "Connecting flight cancelled due to a mechanical issue; required an overnight hotel stay and rebooking fee. Airline cancellation notice and hotel receipt attached.",
    status: "approved",
    createdAt: "2026-09-05T07:15:00Z",
    document: { fileName: "airline-cancellation-hotel-receipt.pdf", sizeBytes: 238_512 },
    timeline: [
      { at: "2026-09-05T07:15:00Z", title: "Claim received" },
      { at: "2026-09-05T07:16:00Z", title: "Document checks passed" },
      { at: "2026-09-08T13:30:00Z", title: "Reviewed by claims specialist" },
      {
        at: "2026-09-09T10:00:00Z",
        title: "Claim approved",
        detail: "Reimbursement of $960.00 scheduled.",
      },
    ],
  },
  {
    id: "PRV-1043",
    origin: "preview",
    policyNumber: "CP-62048813",
    incidentDate: "2026-08-17",
    category: "theft",
    amount: 2199.99,
    description:
      "Laptop bag stolen from a locked car parked outside a grocery store. Police report number and original purchase receipt for the laptop attached.",
    status: "rejected",
    createdAt: "2026-08-18T12:05:00Z",
    document: { fileName: "police-report-and-receipt.pdf", sizeBytes: 655_360 },
    timeline: [
      { at: "2026-08-18T12:05:00Z", title: "Claim received" },
      { at: "2026-08-18T12:06:00Z", title: "Document checks passed" },
      {
        at: "2026-08-25T16:45:00Z",
        title: "Claim declined",
        detail: "Items left in vehicles are excluded under section 4.2 of this policy.",
      },
    ],
  },
  {
    id: "PRV-1041",
    origin: "preview",
    policyNumber: "CP-30987154",
    incidentDate: "2026-08-03",
    category: "health",
    amount: 1475,
    description:
      "Emergency room visit after a sprained ankle while hiking; X-ray and follow-up physiotherapy session. Itemized hospital bill attached.",
    status: "received",
    createdAt: "2026-10-20T08:00:00Z",
    document: { fileName: "itemized-hospital-bill.pdf", sizeBytes: 301_220 },
    timeline: [{ at: "2026-10-20T08:00:00Z", title: "Claim received" }],
  },
];

export function getPreviewClaims(): readonly Claim[] {
  return SAMPLE_CLAIMS;
}

export function getPreviewClaim(id: string): Claim | undefined {
  return SAMPLE_CLAIMS.find((c) => c.id.toUpperCase() === id.toUpperCase());
}
