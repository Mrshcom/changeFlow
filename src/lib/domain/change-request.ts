export const requestStatuses = ["Draft", "PendingReview", "Approved", "ChangesRequested"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export type RequestInput = { title: string; description: string; reason: string };
export type ChangeRequest = RequestInput & {
  id: string;
  requesterId: string;
  status: RequestStatus;
  version: string;
  createdAt: string;
  updatedAt: string;
};

export function parseRequestInput(value: unknown): RequestInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A JSON object with title, description, and reason is required.");
  }
  const input = value as Record<string, unknown>;
  const fields = ["title", "description", "reason"] as const;
  const result = {} as RequestInput;
  for (const field of fields) {
    if (typeof input[field] !== "string" || input[field].trim().length === 0) {
      throw new Error(`${field} is required and must not be blank.`);
    }
    result[field] = input[field].trim();
  }
  return result;
}
