import { auth } from "@/lib/auth/auth";
import { ApplicationError } from "@/lib/application/errors";
import { parseRequestInput } from "@/lib/domain/change-request";
import { parseReturnReason } from "@/lib/domain/review-decision";
import { problem, internalProblem } from "@/lib/http/problem-details";

export async function requireUser(request: Request): Promise<{ userId: string } | Response> {
  try {
    const result = await auth.api.getSession({ headers: request.headers });
    if (!result?.user?.id) return problem(401, "unauthorized", "A valid session is required.");
    return { userId: result.user.id };
  } catch (error) {
    return internalProblem(error);
  }
}

export async function parseBody(request: Request): Promise<ReturnType<typeof parseRequestInput> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, "bad_request", "A valid JSON request body is required.");
  }
  try {
    return parseRequestInput(body);
  } catch (error) {
    return problem(400, "bad_request", error instanceof Error ? error.message : "Required request fields are invalid.");
  }
}

export async function parseOptionalReason(request: Request): Promise<string | null | Response> {
  if (!request.headers.get("content-length") && request.method === "POST") {
    const text = await request.clone().text();
    if (!text.trim()) return null;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, "bad_request", "A valid JSON request body is required when a reason is supplied.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return problem(400, "bad_request", "The request body must be a JSON object.");
  }
  try {
    return parseReturnReason((body as Record<string, unknown>).reason);
  } catch (error) {
    return problem(400, "bad_request", error instanceof Error ? error.message : "The reason is invalid.");
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApplicationError) return problem(error.status, error.code, error.message);
  return internalProblem(error);
}

export function jsonWithEtag(value: unknown, status: number, version: string): Response {
  return Response.json(value, { status, headers: { ETag: `"${version}"` } });
}
