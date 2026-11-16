import type Database from "better-sqlite3";
import { getUserRoles } from "@/lib/auth/authorization";
import { ApplicationError } from "@/lib/application/errors";
import type { ChangeRequest } from "@/lib/domain/change-request";
import type { ReviewDecision } from "@/lib/domain/review-decision";

export type RequestWithHistory = ChangeRequest & { reviewHistory: ReviewDecision[] };

function visibleCondition(roles: string[], userId: string): { sql: string; params: unknown[] } {
  if (roles.includes("Requester") && roles.includes("Reviewer")) {
    return { sql: "(requesterId = ? OR status = 'PendingReview')", params: [userId] };
  }
  if (roles.includes("Requester")) return { sql: "requesterId = ?", params: [userId] };
  if (roles.includes("Reviewer")) return { sql: "status = 'PendingReview'", params: [] };
  throw new ApplicationError(403, "forbidden", "A ChangeFlow role is required.");
}

export function listVisibleRequests(db: Database.Database, userId: string): RequestWithHistory[] {
  const roles = getUserRoles(userId, db);
  const where = visibleCondition(roles, userId);
  const rows = db.prepare(`SELECT * FROM ChangeRequest WHERE ${where.sql} ORDER BY createdAt DESC`).all(...where.params) as ChangeRequest[];
  return rows.map((row) => withHistory(db, row));
}

export function getVisibleRequest(db: Database.Database, userId: string, requestId: string): RequestWithHistory {
  const roles = getUserRoles(userId, db);
  const where = visibleCondition(roles, userId);
  const row = db.prepare(`SELECT * FROM ChangeRequest WHERE id = ? AND ${where.sql}`).get(requestId, ...where.params) as ChangeRequest | undefined;
  if (!row) throw new ApplicationError(404, "not_found", "Request was not found.");
  return withHistory(db, row);
}

function withHistory(db: Database.Database, row: ChangeRequest): RequestWithHistory {
  const reviewHistory = db.prepare(`SELECT id, requestId, reviewerId, decision, reason, decidedAt FROM ReviewDecision
    WHERE requestId = ? ORDER BY decidedAt ASC, id ASC`).all(row.id) as ReviewDecision[];
  return { ...row, reviewHistory };
}
