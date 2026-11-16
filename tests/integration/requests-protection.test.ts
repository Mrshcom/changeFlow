import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDatabase, provisionTestUser, sessionCookie, type TestDatabase } from "../helpers/database";
import { createDraft, submitOwnedRequest } from "@/lib/application/change-request-service";
import { assignRole, revokeRole } from "@/lib/auth/authorization";

describe("visibility, authorization, immutability, and concurrency protection", () => {
  let fixture: TestDatabase;
  let db: Database.Database;
  let requester: { id: string; cookie: string };
  let otherRequester: { id: string; cookie: string };
  let reviewer: { id: string; cookie: string };
  let secondReviewer: { id: string; cookie: string };
  let dualRole: { id: string; cookie: string };
  let list: (request: Request) => Promise<Response>;
  let get: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let update: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let approve: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;

  beforeAll(async () => {
    fixture = await createTestDatabase();
    db = fixture.db;
    process.env.DATABASE_PATH = fixture.path;
    process.env.BETTER_AUTH_SECRET = "changeflow-test-secret-that-is-long-enough-123456";
    const [collection, detail, approval] = await Promise.all([
      import("@/app/api/requests/route"),
      import("@/app/api/requests/[requestId]/route"),
      import("@/app/api/requests/[requestId]/approve/route"),
    ]);
    list = collection.GET;
    get = detail.GET;
    update = detail.PUT;
    approve = approval.POST;
    const { createAuth } = await import("@/lib/auth/auth");
    const auth = createAuth(db);
    const makeUser = async (name: string, roles: ("Requester" | "Reviewer")[]) => {
      const result = await provisionTestUser(db, name, `${name}-${crypto.randomUUID()}@example.test`, undefined, roles);
      const signed = await auth.api.signInEmail({ body: { email: result.user.email, password: result.password }, asResponse: true });
      return { id: result.user.id, cookie: sessionCookie(signed.headers.get("set-cookie")) };
    };
    requester = await makeUser("protection-owner", ["Requester"]);
    otherRequester = await makeUser("protection-other", ["Requester"]);
    reviewer = await makeUser("protection-reviewer", ["Reviewer"]);
    secondReviewer = await makeUser("protection-reviewer-two", ["Reviewer"]);
    dualRole = await makeUser("protection-dual", ["Requester", "Reviewer"]);
  });

  afterAll(() => fixture?.dispose());

  function draft(userId: string, title: string) {
    return createDraft(db, userId, { title, description: "Details", reason: "Reason" });
  }

  function pending(userId: string, title: string) {
    const created = draft(userId, title);
    return submitOwnedRequest(db, userId, created.id, created.version);
  }

  it("shows requesters only their requests and Reviewers only pending requests", async () => {
    const ownerDraft = draft(requester.id, "Owner draft");
    const otherDraft = draft(otherRequester.id, "Other draft");
    const pendingRequest = pending(otherRequester.id, "Pending request");
    const ownList = await list(new Request("http://localhost/api/requests", { headers: { cookie: requester.cookie } }));
    const reviewerList = await list(new Request("http://localhost/api/requests", { headers: { cookie: reviewer.cookie } }));
    const ownIds = (await ownList.json()).map((item: { id: string }) => item.id);
    const reviewerIds = (await reviewerList.json()).map((item: { id: string }) => item.id);
    expect(ownIds).toContain(ownerDraft.id);
    expect(ownIds).not.toContain(otherDraft.id);
    expect(ownIds).not.toContain(pendingRequest.id);
    expect(reviewerIds).toContain(pendingRequest.id);
    expect(reviewerIds).not.toContain(otherDraft.id);
    const invisible = await get(new Request(`http://localhost/api/requests/${otherDraft.id}`, { headers: { cookie: requester.cookie } }), {
      params: Promise.resolve({ requestId: otherDraft.id }),
    });
    expect(invisible.status).toBe(404);
  });

  it("gives dual-role users the union of own requests and pending requests", async () => {
    const own = draft(dualRole.id, "Dual own draft");
    const anotherPending = pending(otherRequester.id, "Visible pending request");
    const anotherDraft = draft(otherRequester.id, "Invisible draft");
    const response = await list(new Request("http://localhost/api/requests", { headers: { cookie: dualRole.cookie } }));
    const ids = (await response.json()).map((item: { id: string }) => item.id);
    expect(ids).toContain(own.id);
    expect(ids).toContain(anotherPending.id);
    expect(ids).not.toContain(anotherDraft.id);
  });

  it("uses current role membership after revocation", async () => {
    const pendingRequest = pending(otherRequester.id, "Pending before revoke");
    revokeRole(reviewer.id, "Reviewer", db);
    const response = await list(new Request("http://localhost/api/requests", { headers: { cookie: reviewer.cookie } }));
    expect(await response.json()).toEqual([]);
    const decision = await approve(new Request(`http://localhost/api/requests/${pendingRequest.id}/approve`, {
      method: "POST", headers: { cookie: reviewer.cookie, "if-match": `"${pendingRequest.version}"` },
    }), { params: Promise.resolve({ requestId: pendingRequest.id }) });
    expect(decision.status).toBe(403);

    const owned = draft(requester.id, "Requester's draft");
    revokeRole(requester.id, "Requester", db);
    const edit = await update(new Request(`http://localhost/api/requests/${owned.id}`, {
      method: "PUT",
      headers: { cookie: requester.cookie, "if-match": `"${owned.version}"`, "content-type": "application/json" },
      body: JSON.stringify({ title: "Changed", description: "Details", reason: "Reason" }),
    }), { params: Promise.resolve({ requestId: owned.id }) });
    expect(edit.status).toBe(403);
    assignRole(reviewer.id, "Reviewer", db);
    assignRole(requester.id, "Requester", db);
  });

  it("keeps approved requests immutable", async () => {
    const toApprove = pending(requester.id, "Approved title");
    const approval = await approve(new Request(`http://localhost/api/requests/${toApprove.id}/approve`, {
      method: "POST", headers: { cookie: reviewer.cookie, "if-match": `"${toApprove.version}"` },
    }), { params: Promise.resolve({ requestId: toApprove.id }) });
    expect(approval.status).toBe(200);
    const current = await get(new Request(`http://localhost/api/requests/${toApprove.id}`, { headers: { cookie: requester.cookie } }), {
      params: Promise.resolve({ requestId: toApprove.id }),
    });
    const etag = current.headers.get("etag")!;
    const edit = await update(new Request(`http://localhost/api/requests/${toApprove.id}`, {
      method: "PUT",
      headers: { cookie: requester.cookie, "if-match": etag, "content-type": "application/json" },
      body: JSON.stringify({ title: "Must not change", description: "Details", reason: "Reason" }),
    }), { params: Promise.resolve({ requestId: toApprove.id }) });
    expect(edit.status).toBe(409);
    expect(db.prepare("SELECT title, status FROM ChangeRequest WHERE id = ?").get(toApprove.id)).toEqual({ title: "Approved title", status: "Approved" });
  });

  it("allows only one of two concurrent edits using the same version", async () => {
    const created = draft(requester.id, "Before concurrent edit");
    const context = { params: Promise.resolve({ requestId: created.id }) };
    const editWith = (title: string) => update(new Request(`http://localhost/api/requests/${created.id}`, {
      method: "PUT",
      headers: { cookie: requester.cookie, "if-match": `"${created.version}"`, "content-type": "application/json" },
      body: JSON.stringify({ title, description: "Details", reason: "Reason" }),
    }), context);
    const results = await Promise.all([editWith("First write"), editWith("Second write")]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 412]);
    const saved = db.prepare("SELECT title FROM ChangeRequest WHERE id = ?").get(created.id) as { title: string };
    expect(["First write", "Second write"]).toContain(saved.title);
  });

  it("allows only one of two concurrent Reviewer decisions", async () => {
    const toReview = pending(otherRequester.id, "One review only");
    const decide = (cookie: string) => approve(new Request(`http://localhost/api/requests/${toReview.id}/approve`, {
      method: "POST", headers: { cookie, "if-match": `"${toReview.version}"` },
    }), { params: Promise.resolve({ requestId: toReview.id }) });
    const results = await Promise.all([decide(reviewer.cookie), decide(secondReviewer.cookie)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 412]);
    expect(db.prepare("SELECT count(*) AS count FROM ReviewDecision WHERE requestId = ?").get(toReview.id)).toEqual({ count: 1 });
    expect(db.prepare("SELECT status FROM ChangeRequest WHERE id = ?").get(toReview.id)).toEqual({ status: "Approved" });
  });
});
