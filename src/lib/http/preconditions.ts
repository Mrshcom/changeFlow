import { problem } from "@/lib/http/problem-details";

export function etagFor(version: string): string {
  return `"${version}"`;
}

export function setEtag(response: Response, version: string): Response {
  response.headers.set("ETag", etagFor(version));
  return response;
}

export function expectedVersion(request: Request): { version: string } | { error: Response } {
  const value = request.headers.get("if-match");
  if (!value) return { error: problem(428, "precondition_required", "Send the current ETag in the If-Match header.") };
  const match = /^"([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"$/i.exec(value.trim());
  if (!match) return { error: problem(400, "bad_request", "If-Match must contain one strong ETag returned by this API.") };
  return { version: match[1] };
}
