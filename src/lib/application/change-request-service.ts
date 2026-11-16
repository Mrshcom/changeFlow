import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { hasRole } from "@/lib/auth/authorization";
import { ApplicationError } from "@/lib/application/errors";
import { getVisibleRequest } from "@/lib/application/request-query-service";
import type { ChangeRequest, RequestInput } from "@/lib/domain/change-request";

type RequestRow = ChangeRequest;

function getOwnedRequest(db: Database.Database, requestId: string, userId: string): RequestRow {
  const row = db.prepare("SELECT * FROM ChangeRequest WHERE id = ? AND requesterId = ?").get(requestId, userId) as RequestRow | undefined;
  if (!row) throw new ApplicationError(404, "not_found", "Request was not found.");
  return row;
}

function requireRequester(userId: string, db: Database.Database): void {
  if (!hasRole(userId, "Requester", db)) throw new ApplicationError(403, "forbidden", "Requester permission is required.");
}

function classifyNoUpdate(db: Database.Database, requestId: string, userId: string, expectedVersion: string): never {
  const row = getOwnedRequest(db, requestId, userId);
  if (row.version !== expectedVersion) throw new ApplicationError(412, "precondition_failed", "The request changed. Read it again and retry with its latest ETag.");
  throw new ApplicationError(409, "conflict", `A request in ${row.status} cannot perform this operation.`);
}

export function createDraft(db: Database.Database, userId: string, input: RequestInput): RequestRow {
  requireRequester(userId, db);
  const now = new Date().toISOString();
  const row: RequestRow = {
    id: randomUUID(),
    ...input,
    requesterId: userId,
    status: "Draft",
    version: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(`INSERT INTO ChangeRequest (id, title, description, reason, requesterId, status, version, createdAt, updatedAt)
    VALUES (@id, @title, @description, @reason, @requesterId, @status, @version, @createdAt, @updatedAt)`).run(row);
  return row;
}

export function editOwnedRequest(db: Database.Database, userId: string, requestId: string, expectedVersion: string, input: RequestInput): RequestRow {
  requireRequester(userId, db);
  const now = new Date().toISOString();
  const nextVersion = randomUUID();
  const result = db.prepare(`UPDATE ChangeRequest SET title = ?, description = ?, reason = ?, version = ?, updatedAt = ?
    WHERE id = ? AND requesterId = ? AND status IN ('Draft', 'ChangesRequested') AND version = ?`)
    .run(input.title, input.description, input.reason, nextVersion, now, requestId, userId, expectedVersion);
  if (result.changes !== 1) classifyNoUpdate(db, requestId, userId, expectedVersion);
  return getVisibleRequest(db, userId, requestId);
}

export function submitOwnedRequest(db: Database.Database, userId: string, requestId: string, expectedVersion: string): RequestRow {
  requireRequester(userId, db);
  const now = new Date().toISOString();
  const nextVersion = randomUUID();
  const result = db.prepare(`UPDATE ChangeRequest SET status = 'PendingReview', version = ?, updatedAt = ?
    WHERE id = ? AND requesterId = ? AND status IN ('Draft', 'ChangesRequested') AND version = ?
    AND length(trim(title)) > 0 AND length(trim(description)) > 0 AND length(trim(reason)) > 0`)
    .run(nextVersion, now, requestId, userId, expectedVersion);
  if (result.changes !== 1) classifyNoUpdate(db, requestId, userId, expectedVersion);
  return getVisibleRequest(db, userId, requestId);
}
