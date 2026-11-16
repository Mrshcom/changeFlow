import { submitOwnedRequest } from "@/lib/application/change-request-service";
import { getDatabase } from "@/lib/db/connection";
import { expectedVersion } from "@/lib/http/preconditions";
import { errorResponse, jsonWithEtag, requireUser } from "@/lib/http/route-helpers";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const actor = await requireUser(request);
  if (actor instanceof Response) return actor;
  const precondition = expectedVersion(request);
  if ("error" in precondition) return precondition.error;
  try {
    const { requestId } = await context.params;
    const submitted = submitOwnedRequest(getDatabase(), actor.userId, requestId, precondition.version);
    return jsonWithEtag(submitted, 200, submitted.version);
  } catch (error) {
    return errorResponse(error);
  }
}
