import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDatabase, provisionTestUser, sessionCookie, type TestDatabase } from "../helpers/database";
import { getUserRoles } from "@/lib/auth/authorization";

describe("request creation, visibility, editing, and submission", () => {
  let fixture: TestDatabase;
  let db: Database.Database;
  let cookie: string;
  let userId: string;
  let otherCookie: string;
  let listRequests: (request: Request) => Promise<Response>;
  let getRequest: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let updateRequest: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let submitRequest: (request: Request, context: { params: Promise<{ requestId: string }> }) => Promise<Response>;
  let createRequest: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    fixture = await createTestDatabase();
    db = fixture.db;
    process.env.DATABASE_PATH = fixture.path;
    process.env.BETTER_AUTH_SECRET = "changeflow-test-secret-that-is-long-enough-123456";
    const [{ POST, GET }, detail, submit] = await Promise.all([
      import("@/app/api/requests/route"),
      import("@/app/api/requests/[requestId]/route"),
      import("@/app/api/requests/[requestId]/submit/route"),
    ]);
    createRequest = POST;
    listRequests = GET;
    getRequest = detail.GET;
    updateRequest = detail.PUT;
    submitRequest = submit.POST;
    const { createAuth } = await import("@/lib/auth/auth");
    const auth = createAuth(db);
    const requester = await provisionTestUser(db, "Owner", `owner-${crypto.randomUUID()}@example.test`);
    userId = requester.user.id;
    const signedIn = await auth.api.signInEmail({
      body: { email: requester.user.email, password: requester.password },
      asResponse: true,
    });
    cookie = sessionCookie(signedIn.headers.get("set-cookie"));
    const other = await provisionTestUser(db, "Other", `other-${crypto.randomUUID()}@example.test`);
    const otherSignIn = await auth.api.signInEmail({
      body: { email: other.user.email, password: other.password },
      asResponse: true,
    });
    otherCookie = sessionCookie(otherSignIn.headers.get("set-cookie"));
  });

  afterAll(() => fixture?.dispose());

  it("creates and persists an owner-assigned Draft with a strong ETag", async () => {
    const response = await createRequest(new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Network update", description: "Update a router", reason: "Capacity" }),
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(response.headers.get("etag")).toMatch(/^"[0-9a-f-]+"$/i);
    expect(body.status).toBe("Draft");
    expect(body.requesterId).toBe(userId);
    expect(db.prepare("SELECT status FROM ChangeRequest WHERE id = ?").get(body.id)).toEqual({ status: "Draft" });
  });

  it("assigns only Requester permission to a newly registered account", async () => {
    const { createAuth } = await import("@/lib/auth/auth");
    const result = await createAuth(db).api.signUpEmail({
      body: {
        name: "Public signup",
        email: `public-${crypto.randomUUID()}@example.test`,
        password: "Test-password-123!",
        role: "Reviewer",
      } as never,
    });
    expect(getUserRoles(result.user.id, db)).toEqual(["Requester"]);
  });

  it.each([
    [{ title: "", description: "Details", reason: "Reason" }],
    [{ title: "Title", description: "   ", reason: "Reason" }],
    [{ title: "Title", description: "Details", reason: "\t " }],
  ])("rejects missing or whitespace-only required fields", async (payload) => {
    const response = await createRequest(new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    expect(response.status).toBe(400);
  });

  it("limits list and detail reads to requests visible to the caller", async () => {
    const created = await createRequest(new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Private", description: "Details", reason: "Reason" }),
    }));
    const body = await created.json();
    const list = await listRequests(new Request("http://localhost/api/requests", { headers: { cookie: otherCookie } }));
    expect((await list.json()).some((item: { id: string }) => item.id === body.id)).toBe(false);
    const detail = await getRequest(new Request(`http://localhost/api/requests/${body.id}`, { headers: { cookie: otherCookie } }), {
      params: Promise.resolve({ requestId: body.id }),
    });
    expect(detail.status).toBe(404);
  });

  it("requires If-Match, rejects stale edits, and persists a valid edit", async () => {
    const created = await createRequest(new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Original", description: "Details", reason: "Reason" }),
    }));
    const body = await created.json();
    const url = `http://localhost/api/requests/${body.id}`;
    const context = { params: Promise.resolve({ requestId: body.id }) };
    const payload = { title: "Edited", description: "New details", reason: "Reason" };
    const withoutPrecondition = await updateRequest(new Request(url, {
      method: "PUT", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(payload),
    }), context);
    expect(withoutPrecondition.status).toBe(428);
    const stale = await updateRequest(new Request(url, {
      method: "PUT", headers: { cookie, "content-type": "application/json", "if-match": '"00000000-0000-4000-8000-000000000000"' }, body: JSON.stringify(payload),
    }), context);
    expect(stale.status).toBe(412);
    const updated = await updateRequest(new Request(url, {
      method: "PUT", headers: { cookie, "content-type": "application/json", "if-match": created.headers.get("etag")! }, body: JSON.stringify(payload),
    }), context);
    expect(updated.status).toBe(200);
    const updatedBody = await updated.json();
    expect(updatedBody.title).toBe("Edited");
    expect(updated.headers.get("etag")).not.toBe(created.headers.get("etag"));
    expect(db.prepare("SELECT title FROM ChangeRequest WHERE id = ?").get(body.id)).toEqual({ title: "Edited" });
  });

  it("submits a draft with its current ETag and advances the persisted state", async () => {
    const created = await createRequest(new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Ready", description: "Details", reason: "Reason" }),
    }));
    const body = await created.json();
    const response = await submitRequest(new Request(`http://localhost/api/requests/${body.id}/submit`, {
      method: "POST", headers: { cookie, "if-match": created.headers.get("etag")! },
    }), { params: Promise.resolve({ requestId: body.id }) });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("PendingReview");
    expect(db.prepare("SELECT status FROM ChangeRequest WHERE id = ?").get(body.id)).toEqual({ status: "PendingReview" });
  });
});
