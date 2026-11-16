export type ProblemCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "precondition_failed"
  | "precondition_required"
  | "internal_error";

const titles: Record<ProblemCode, string> = {
  bad_request: "Bad Request",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  not_found: "Not Found",
  conflict: "Conflict",
  precondition_failed: "Precondition Failed",
  precondition_required: "Precondition Required",
  internal_error: "Internal Server Error",
};

export function problem(status: number, code: ProblemCode, detail: string): Response {
  return Response.json(
    { type: `https://httpstatuses.com/${status}`, title: titles[code], status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

export function internalProblem(error: unknown): Response {
  const type = error instanceof Error ? error.name : "Unknown error";
  console.error(`ChangeFlow request failed (${type}).`);
  return problem(500, "internal_error", "The request could not be completed.");
}
