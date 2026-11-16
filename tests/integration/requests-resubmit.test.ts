import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDatabase, provisionTestUser, sessionCookie, type TestDatabase } from "../helpers/database";
import { createDraft, submitOwnedRequest } from "@/lib/application/change-request-service";

describe("requester revision and resubmission", () => {
  let fixture: TestDatabase;
  let db: Database.Database;
  let owner: { id: string; cookie: string };
  let other: { id: string; cookie: string };
  let reviewerCookie: string;
  let update: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let submit: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let get: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let returnForChanges: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;

  beforeAll(async () => {
    fixture = await createTestDatabase();
    db = fixture.db;
    process.env.DATABASE_PATH = fixture.path;
    process.env.BETTER_AUTH_SECRET = "changeflow-test-secret-that-is-long-enough-123456";
    const [detail, submitRoute, returnRoute] = await Promise.all([
      import("@/app/api/requests/[requestId]/route"),
      import("@/app/api/requests/[requestId]/submit/route"),
      import("@/app/api/requests/[requestId]/request-changes/route"),
    ]);
    update = detail.PUT;
    get = detail.GET;
    submit = submitRoute.POST;
    returnForChanges = returnRoute.POST;
    const { createAuth } = await import("@/lib/auth/auth");
    const auth = createAuth(db);
    const makeUser = async (name: string, roles: ("Requester" | "Reviewer")[]) => {
      const result = await provisionTestUser(db, name, `${name}-${crypto.randomUUID()}@example.test`, undefined, roles);
      const signed = await auth.api.signInEmail({ body: { email: result.user.email, password: result.password }, asResponse: true });
      return { id: result.user.id, cookie: sessionCookie(signed.headers.get("set-cookie")) };
    };
    owner = await makeUser("resubmit-owner", ["Requester"]);
    other = await makeUser("resubmit-other", ["Requester"]);
    reviewerCookie = (await makeUser("resubmit-reviewer", ["Reviewer"])).cookie;
  });

  afterAll(() => fixture?.dispose());

  it("lets the owner edit and resubmit while preserving the optional review history", async () => {
    const draft = createDraft(db, owner.id, { title: "Original", description: "Details", reason: "Reason" });
    const pending = submitOwnedRequest(db, owner.id, draft.id, draft.version);
    const context = { params: Promise.resolve({ requestId: draft.id }) };
    const returned = await returnForChanges(new Request(`http://localhost/api/requests/${draft.id}/request-changes`, {
      method: "POST",
      headers: { cookie: reviewerCookie, "if-match": `"${pending.version}"`, "content-type": "application/json" },
      body: JSON.stringify({ reason: "Please add a rollback plan." }),
    }), context);
    expect(returned.status).toBe(200);

    const visible = await get(new Request(`http://localhost/api/requests/${draft.id}`, { headers: { cookie: owner.cookie } }), context);
    const returnedBody = await visible.json();
    expect(returnedBody.status).toBe("ChangesRequested");
    expect(returnedBody.reviewHistory).toHaveLength(1);
    expect(returnedBody.reviewHistory[0].reason).toBe("Please add a rollback plan.");

    const edited = await update(new Request(`http://localhost/api/requests/${draft.id}`, {
      method: "PUT",
      headers: { cookie: owner.cookie, "if-match": visible.headers.get("etag")!, "content-type": "application/json" },
      body: JSON.stringify({ title: "Revised", description: "Details with rollback", reason: "Reason" }),
    }), context);
    expect(edited.status).toBe(200);
    const editedBody = await edited.json();
    expect(editedBody.status).toBe("ChangesRequested");
    expect(editedBody.title).toBe("Revised");
    expect(editedBody.reviewHistory).toHaveLength(1);

    const otherEdit = await update(new Request(`http://localhost/api/requests/${draft.id}`, {
      method: "PUT",
      headers: { cookie: other.cookie, "if-match": edited.headers.get("etag")!, "content-type": "application/json" },
      body: JSON.stringify({ title: "Intrusion", description: "Details", reason: "Reason" }),
    }), context);
    expect(otherEdit.status).toBe(404);

    const resubmitted = await submit(new Request(`http://localhost/api/requests/${draft.id}/submit`, {
      method: "POST", headers: { cookie: owner.cookie, "if-match": edited.headers.get("etag")! },
    }), context);
    expect(resubmitted.status).toBe(200);
    const finalBody = await resubmitted.json();
    expect(finalBody.status).toBe("PendingReview");
    expect(finalBody.reviewHistory).toHaveLength(1);
    expect(finalBody.reviewHistory[0].reason).toBe("Please add a rollback plan.");
    expect(db.prepare("SELECT title, status FROM ChangeRequest WHERE id = ?").get(draft.id)).toEqual({ title: "Revised", status: "PendingReview" });
  });
});
