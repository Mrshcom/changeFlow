import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDatabase, provisionTestUser, sessionCookie, type TestDatabase } from "../helpers/database";
import { createDraft, submitOwnedRequest } from "@/lib/application/change-request-service";
import { getUserRoles } from "@/lib/auth/authorization";

describe("review decisions", () => {
  let fixture: TestDatabase;
  let db: Database.Database;
  let reviewerCookie: string;
  let ownerCookie: string;
  let requesterCookie: string;
  let dualCookie: string;
  let approve: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let requestChanges: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let getDetail: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;

  beforeAll(async () => {
    fixture = await createTestDatabase();
    db = fixture.db;
    process.env.DATABASE_PATH = fixture.path;
    process.env.BETTER_AUTH_SECRET = "changeflow-test-secret-that-is-long-enough-123456";
    const [approveRoute, returnRoute, detailRoute] = await Promise.all([
      import("@/app/api/requests/[requestId]/approve/route"),
      import("@/app/api/requests/[requestId]/request-changes/route"),
      import("@/app/api/requests/[requestId]/route"),
    ]);
    approve = approveRoute.POST;
    requestChanges = returnRoute.POST;
    getDetail = detailRoute.GET;
    const { createAuth } = await import("@/lib/auth/auth");
    const auth = createAuth(db);
    const signIn = async (name: string, roles: ("Requester" | "Reviewer")[]) => {
      const user = await provisionTestUser(db, name, `${name}-${crypto.randomUUID()}@example.test`, undefined, roles);
      const result = await auth.api.signInEmail({ body: { email: user.user.email, password: user.password }, asResponse: true });
      return sessionCookie(result.headers.get("set-cookie"));
    };
    reviewerCookie = await signIn("reviewer", ["Reviewer"]);
    ownerCookie = await signIn("owner", ["Requester"]);
    requesterCookie = await signIn("requester", ["Requester"]);
    dualCookie = await signIn("dual", ["Requester", "Reviewer"]);
    const reviewer = db.prepare("SELECT id FROM user WHERE email LIKE 'reviewer-%@example.test' ORDER BY createdAt DESC LIMIT 1").get() as { id: string };
    expect(getUserRoles(reviewer.id, db)).toEqual(["Reviewer"]);
  });

  afterAll(() => fixture?.dispose());

  async function createPending(ownerEmailPrefix: string, ownerCookieValue: string) {
    const ownerId = db.prepare("SELECT id FROM user WHERE email LIKE ? ORDER BY createdAt DESC LIMIT 1").get(`${ownerEmailPrefix}-%@example.test`) as { id: string };
    const request = createDraft(db, ownerId.id, { title: "Change", description: "Details", reason: "Reason" });
    const pending = submitOwnedRequest(db, ownerId.id, request.id, request.version);
    return { ...pending, ownerCookie: ownerCookieValue };
  }

  it("approves a pending request and persists reviewer, time, and state atomically", async () => {
    const pending = await createPending("owner", ownerCookie);
    const response = await approve(new Request(`http://localhost/api/requests/${pending.id}/approve`, {
      method: "POST", headers: { cookie: reviewerCookie, "if-match": `"${pending.version}"` },
    }), { params: Promise.resolve({ requestId: pending.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("Approved");
    expect(response.headers.get("etag")).not.toBe(`"${pending.version}"`);
    expect(db.prepare("SELECT status FROM ChangeRequest WHERE id = ?").get(pending.id)).toEqual({ status: "Approved" });
    const decision = db.prepare("SELECT decision, reviewerId, decidedAt FROM ReviewDecision WHERE requestId = ?").get(pending.id) as Record<string, string>;
    expect(decision.decision).toBe("Approved");
    expect(decision.reviewerId).toBeTruthy();
    expect(decision.decidedAt).toBeTruthy();
  });

  it("returns a request with or without an optional reason and exposes history to its owner", async () => {
    const withoutReason = await createPending("owner", ownerCookie);
    const noReasonResponse = await requestChanges(new Request(`http://localhost/api/requests/${withoutReason.id}/request-changes`, {
      method: "POST", headers: { cookie: reviewerCookie, "if-match": `"${withoutReason.version}"` },
    }), { params: Promise.resolve({ requestId: withoutReason.id }) });
    expect(noReasonResponse.status).toBe(200);
    expect(db.prepare("SELECT reason FROM ReviewDecision WHERE requestId = ?").get(withoutReason.id)).toEqual({ reason: null });

    const withReason = await createPending("owner", ownerCookie);
    const reasonResponse = await requestChanges(new Request(`http://localhost/api/requests/${withReason.id}/request-changes`, {
      method: "POST",
      headers: { cookie: reviewerCookie, "if-match": `"${withReason.version}"`, "content-type": "application/json" },
      body: JSON.stringify({ reason: "Please include a rollback plan." }),
    }), { params: Promise.resolve({ requestId: withReason.id }) });
    expect(reasonResponse.status).toBe(200);
    const detail = await getDetail(new Request(`http://localhost/api/requests/${withReason.id}`, { headers: { cookie: ownerCookie } }), {
      params: Promise.resolve({ requestId: withReason.id }),
    });
    const detailBody = await detail.json();
    expect(detailBody.reviewHistory[0].reason).toBe("Please include a rollback plan.");
    expect(detailBody.reviewHistory[0].reviewerId).toBeTruthy();
  });

  it("rejects self-review by a user who holds both roles", async () => {
    const owner = db.prepare("SELECT id FROM user WHERE email LIKE 'dual-%@example.test' ORDER BY createdAt DESC LIMIT 1").get() as { id: string };
    const request = createDraft(db, owner.id, { title: "Own change", description: "Details", reason: "Reason" });
    const pending = submitOwnedRequest(db, owner.id, request.id, request.version);
    const response = await approve(new Request(`http://localhost/api/requests/${pending.id}/approve`, {
      method: "POST", headers: { cookie: dualCookie, "if-match": `"${pending.version}"` },
    }), { params: Promise.resolve({ requestId: pending.id }) });
    expect(response.status).toBe(403);
    expect(db.prepare("SELECT status FROM ChangeRequest WHERE id = ?").get(pending.id)).toEqual({ status: "PendingReview" });
    expect(db.prepare("SELECT count(*) AS count FROM ReviewDecision WHERE requestId = ?").get(pending.id)).toEqual({ count: 0 });
  });

  it("rejects users without Reviewer permission", async () => {
    const pending = await createPending("owner", ownerCookie);
    const response = await approve(new Request(`http://localhost/api/requests/${pending.id}/approve`, {
      method: "POST", headers: { cookie: requesterCookie, "if-match": `"${pending.version}"` },
    }), { params: Promise.resolve({ requestId: pending.id }) });
    expect(response.status).toBe(403);
    expect(db.prepare("SELECT status FROM ChangeRequest WHERE id = ?").get(pending.id)).toEqual({ status: "PendingReview" });
  });

  it("requires the current If-Match version for review transitions", async () => {
    const pending = await createPending("owner", ownerCookie);
    const response = await approve(new Request(`http://localhost/api/requests/${pending.id}/approve`, {
      method: "POST", headers: { cookie: reviewerCookie },
    }), { params: Promise.resolve({ requestId: pending.id }) });
    expect(response.status).toBe(428);
  });
});
