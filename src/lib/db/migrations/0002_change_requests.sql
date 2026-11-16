CREATE TABLE IF NOT EXISTS ChangeRequest (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  requesterId TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'PendingReview', 'Approved', 'ChangesRequested')),
  version TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_request_requester_created
  ON ChangeRequest (requesterId, createdAt);
CREATE INDEX IF NOT EXISTS idx_change_request_status_created
  ON ChangeRequest (status, createdAt);
