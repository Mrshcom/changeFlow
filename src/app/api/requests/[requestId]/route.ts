import { editOwnedRequest } from "@/lib/application/change-request-service";
import { getVisibleRequest } from "@/lib/application/request-query-service";
import { getDatabase } from "@/lib/db/connection";
import { expectedVersion } from "@/lib/http/preconditions";
import { errorResponse, jsonWithEtag, parseBody, requireUser } from "@/lib/http/route-helpers";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const actor = await requireUser(request);
  if (actor instanceof Response) return actor;
  try {
    const { requestId } = await context.params;
    const detail = getVisibleRequest(getDatabase(), actor.userId, requestId);
    return jsonWithEtag(detail, 200, detail.version);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const actor = await requireUser(request);
  if (actor instanceof Response) return actor;
  const precondition = expectedVersion(request);
  if ("error" in precondition) return precondition.error;
  const input = await parseBody(request);
  if (input instanceof Response) return input;
  try {
    const { requestId } = await context.params;
    const updated = editOwnedRequest(getDatabase(), actor.userId, requestId, precondition.version, input);
    return jsonWithEtag(updated, 200, updated.version);
  } catch (error) {
    return errorResponse(error);
  }
}
