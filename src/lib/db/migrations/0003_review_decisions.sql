CREATE TABLE IF NOT EXISTS ReviewDecision (
  id TEXT PRIMARY KEY NOT NULL,
  requestId TEXT NOT NULL REFERENCES ChangeRequest(id) ON DELETE RESTRICT,
  reviewerId TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('Approved', 'ChangesRequested')),
  reason TEXT,
  decidedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_decision_request_time
  ON ReviewDecision (requestId, decidedAt);
