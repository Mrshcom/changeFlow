export const reviewDecisions = ["Approved", "ChangesRequested"] as const;
export type ReviewDecisionType = (typeof reviewDecisions)[number];

export type ReviewDecision = {
  id: string;
  requestId: string;
  reviewerId: string;
  decision: ReviewDecisionType;
  reason: string | null;
  decidedAt: string;
};

export function parseReturnReason(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("reason must be a string when supplied.");
  return value.trim() || null;
}
