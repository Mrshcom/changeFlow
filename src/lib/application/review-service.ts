import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { hasRole } from "@/lib/auth/authorization";
import { ApplicationError } from "@/lib/application/errors";
import type { ChangeRequest } from "@/lib/domain/change-request";
import type { ReviewDecision, ReviewDecisionType } from "@/lib/domain/review-decision";

export type ReviewedRequest = ChangeRequest & { reviewHistory: ReviewDecision[] };

export function decideRequest(
  db: Database.Database,
  reviewerId: string,
  requestId: string,
  expectedVersion: string,
  decision: ReviewDecisionType,
  reason: string | null = null,
): ReviewedRequest {
  const transaction = db.transaction(() => {
    if (!hasRole(reviewerId, "Reviewer", db)) {
      throw new ApplicationError(403, "forbidden", "Reviewer permission is required.");
    }
    const current = db.prepare("SELECT * FROM ChangeRequest WHERE id = ?").get(requestId) as ChangeRequest | undefined;
    if (!current) throw new ApplicationError(404, "not_found", "Request was not found.");
    if (current.requesterId === reviewerId) {
      throw new ApplicationError(403, "forbidden", "A requester cannot review their own request.");
    }
    if (current.version !== expectedVersion) {
      throw new ApplicationError(412, "precondition_failed", "The request changed. Read it again and retry with its latest ETag.");
    }
    if (current.status !== "PendingReview") {
      throw new ApplicationError(409, "conflict", `A request in ${current.status} cannot be reviewed.`);
    }

    const decidedAt = new Date().toISOString();
    const nextVersion = randomUUID();
    const nextStatus = decision;
    const update = db.prepare(`UPDATE ChangeRequest SET status = ?, version = ?, updatedAt = ?
      WHERE id = ? AND status = 'PendingReview' AND version = ?`).run(nextStatus, nextVersion, decidedAt, requestId, expectedVersion);
    if (update.changes !== 1) throw new ApplicationError(412, "precondition_failed", "The request changed. Read it again and retry with its latest ETag.");
    const review: ReviewDecision = {
      id: randomUUID(), requestId, reviewerId, decision, reason: decision === "ChangesRequested" ? reason : null, decidedAt,
    };
    db.prepare(`INSERT INTO ReviewDecision (id, requestId, reviewerId, decision, reason, decidedAt)
      VALUES (@id, @requestId, @reviewerId, @decision, @reason, @decidedAt)`).run(review);
    const updated = db.prepare("SELECT * FROM ChangeRequest WHERE id = ?").get(requestId) as ChangeRequest;
    const reviewHistory = db.prepare(`SELECT id, requestId, reviewerId, decision, reason, decidedAt FROM ReviewDecision
      WHERE requestId = ? ORDER BY decidedAt ASC, id ASC`).all(requestId) as ReviewDecision[];
    return { ...updated, reviewHistory };
  });
  return transaction.immediate();
}
