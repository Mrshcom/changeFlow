import { createDraft } from "@/lib/application/change-request-service";
import { listVisibleRequests } from "@/lib/application/request-query-service";
import { getDatabase } from "@/lib/db/connection";
import { errorResponse, jsonWithEtag, parseBody, requireUser } from "@/lib/http/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const actor = await requireUser(request);
  if (actor instanceof Response) return actor;
  try {
    return Response.json(listVisibleRequests(getDatabase(), actor.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const actor = await requireUser(request);
  if (actor instanceof Response) return actor;
  const input = await parseBody(request);
  if (input instanceof Response) return input;
  try {
    const db = getDatabase();
    const created = createDraft(db, actor.userId, input);
    return jsonWithEtag(created, 201, created.version);
  } catch (error) {
    return errorResponse(error);
  }
}
