# Feature Specification: Change Request Workflow

**Feature Branch**: `main`

**Created**: 2026-11-16

**Status**: Implemented; pending product acceptance

**Input**: User description: "Build the initial ChangeFlow change request management system described in Assignment.md."

## Clarifications

### Session 2026-11-16

- Q: Who should be able to view each change request? → A: Requesters can view their own requests; Reviewers can view requests in `PendingReview`.
- Q: Must a Reviewer provide a reason when returning a request for changes? → A: No. A reason is optional.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit a Change Request (Priority: P1)

An employee creates a change request with a title, description, and reason. They can save it as a draft, continue editing their own draft, and submit it for review when it is ready.

**Why this priority**: Creating and submitting requests is the primary value of ChangeFlow and starts the review workflow.

**Independent Test**: Create a request, verify it is a draft with the supplied details, then submit it and verify it is pending review.

**Acceptance Scenarios**:

1. **Given** an authenticated Requester and valid request details, **When** they create a request, **Then** the request is saved as `Draft` with the requester identified as its owner.
2. **Given** a Requester owns a `Draft`, **When** they edit its title, description, or reason, **Then** the updated details are saved and the state remains `Draft`.
3. **Given** a complete `Draft` owned by the Requester, **When** they submit it, **Then** its state becomes `PendingReview`.
4. **Given** a request with a missing required title, description, or reason, **When** it is created or submitted, **Then** the operation is rejected and the request is not advanced to `PendingReview`.

---

### User Story 2 - Review a Pending Request (Priority: P1)

A Reviewer examines a pending change request and either approves it or returns it to its requester, optionally including a reason for changes.

**Why this priority**: Review is the required control point that determines whether a proposed change is approved or needs revision.

**Independent Test**: Start with a pending request and verify that an eligible Reviewer can approve it or return it for changes, with the decision recorded.

**Acceptance Scenarios**:

1. **Given** a `PendingReview` request and an authorized Reviewer who is not its requester, **When** the Reviewer approves it, **Then** its state becomes `Approved` and the reviewer and decision time are recorded.
2. **Given** a `PendingReview` request and an authorized Reviewer who is not its requester, **When** the Reviewer returns it for changes with or without a reason, **Then** its state becomes `ChangesRequested` and any supplied reason is available to the requester.
3. **Given** a Reviewer is also the requester of a `PendingReview` request, **When** they attempt to approve or return that request, **Then** the action is rejected and the request remains `PendingReview`.
4. **Given** a user without Reviewer permission, **When** they attempt to review a pending request, **Then** the action is rejected and the request remains unchanged.

---

### User Story 3 - Revise and Resubmit a Returned Request (Priority: P2)

A Requester updates a request returned for changes and submits the revised request for another review.

**Why this priority**: Returning a request is useful only if the requester can address the feedback and continue the workflow.

**Independent Test**: Return a pending request for changes, revise its details as the requester, resubmit it, and verify that it returns to `PendingReview`.

**Acceptance Scenarios**:

1. **Given** a `ChangesRequested` request owned by the Requester, **When** the Requester edits its details, **Then** the revised details are saved and the request remains `ChangesRequested` until resubmitted.
2. **Given** a complete `ChangesRequested` request owned by the Requester, **When** the Requester resubmits it, **Then** its state becomes `PendingReview`.
3. **Given** a `ChangesRequested` request, **When** someone other than its requester attempts to edit or resubmit it, **Then** the operation is rejected and the request remains unchanged.

---

### User Story 4 - Protect Request State and Concurrent Changes (Priority: P1)

People interacting with a request can only perform actions allowed for their current identity, role, and the request's current state. A stale operation cannot silently overwrite a newer change.

**Why this priority**: Authorization, valid transitions, and concurrency protection preserve the integrity of requests and approvals.

**Independent Test**: Attempt unauthorized and invalid-state actions, then submit a change based on an older version and verify that no newer data or state is overwritten.

**Acceptance Scenarios**:

1. **Given** a request is `Approved`, **When** anyone attempts to edit its details or change its state, **Then** the operation is rejected and the approved request is unchanged.
2. **Given** a request is in a state that does not allow the requested action, **When** a user attempts that action, **Then** it is rejected and the state remains valid.
3. **Given** a user submits an operation based on an older version of a request, **When** a newer version has already been saved, **Then** the stale operation is rejected or reported as a conflict and the newer version remains intact.
4. **Given** a user's role or permission has been revoked, **When** they attempt an operation requiring that permission, **Then** the operation is rejected using their current authorization.

### Edge Cases

- A user has both Requester and Reviewer roles; the self-approval prohibition still applies.
- Two reviewers attempt to act on the same pending request at nearly the same time; at most one valid transition succeeds, and the other receives a conflict or invalid-state result.
- A request is edited or submitted with one or more required fields missing or containing only whitespace; it cannot enter `PendingReview`.
- A request is submitted for review more than once, or reviewed after its state has already changed; the duplicate or stale transition is rejected without changing stored data.
- An unauthorized user guesses or supplies another request's identifier; the system does not disclose or modify that request.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated Requester to create a change request containing a title, description, and reason, and MUST assign the authenticated user as its requester.
- **FR-002**: The system MUST save a newly created change request in the `Draft` state.
- **FR-003**: The system MUST allow a Requester to edit their own request while it is in `Draft` or `ChangesRequested`.
- **FR-004**: The system MUST allow a Requester to submit their complete `Draft` or `ChangesRequested` request for review, changing its state to `PendingReview`.
- **FR-005**: The system MUST allow an authorized Reviewer to approve a `PendingReview` request and record the reviewer and decision time.
- **FR-006**: The system MUST allow an authorized Reviewer to return a `PendingReview` request for changes with an optional reason; any supplied reason MUST be available to the requester.
- **FR-007**: The system MUST prevent a requester from approving or returning their own request, regardless of any Reviewer role they also hold.
- **FR-008**: The system MUST prevent edits to a request in the `Approved` state.
- **FR-009**: The system MUST reject state transitions that are not allowed from the request's current state.
- **FR-010**: The system MUST verify current identity and authorization for each protected operation and MUST use current permissions when processing the operation.
- **FR-011**: The system MUST prevent stale concurrent operations from silently overwriting newer request data or producing an invalid state.
- **FR-012**: The system MUST preserve each request's title, description, reason, requester identity, current state, and the information needed to identify its current version.
- **FR-013**: The system MUST allow Requesters to view only their own requests and allow Reviewers to view only requests in `PendingReview`, subject to current authorization.
- **FR-014**: The system MUST reject creation or submission when title, description, or reason is missing or contains only whitespace.
- **FR-015**: The system MUST return a clear rejection or conflict outcome when an operation fails due to authorization, invalid state, validation, or stale request data, without exposing sensitive implementation details.

### Key Entities

- **Change Request**: A proposed change containing a title, description, reason, requester identity, current workflow state, and current version.
- **User**: An authenticated person who may act as a Requester, a Reviewer, or both; permissions are evaluated for each operation.
- **Review Decision**: The outcome of reviewing a pending request, including the Reviewer, decision, decision time, and, when changes are requested, an optional explanation for the requester.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid request creation and submission scenarios produce a request in the expected state with the submitted required details.
- **SC-002**: 100% of attempts by a requester to review their own request are rejected, including when that user also has the Reviewer role.
- **SC-003**: 100% of unauthorized operations and invalid state transitions are rejected without changing the request.
- **SC-004**: 100% of edit attempts against `Approved` requests are rejected without changing approved content.
- **SC-005**: In every stale-update scenario, the newer saved request remains intact and the stale operation is reported as rejected or conflicting.
- **SC-006**: Requesters can revise and resubmit returned requests, and authorized independent Reviewers can approve or return pending requests in all defined acceptance scenarios.

## Assumptions

- The initial release has two roles: Requester and Reviewer. A person may hold both roles, but cannot review their own request.
- Requesters can view only their own requests. Reviewers can view only requests in `PendingReview`.
- Deleting requests is out of scope for the initial release; drafts and other requests remain available according to the visibility rules above.
- Duplicate or similar requests are allowed; the system does not attempt to merge or detect duplicates in the initial release.
- Authorization uses the user's current role assignment at the time each action is performed. The authentication and role-management mechanism is a design decision for Plan/Research.
- A reason for returning a request for changes is optional. Approval and return decisions are recorded with reviewer identity and decision time for traceability.
- No frontend is required for the initial release. Persistence and concurrency mechanisms are selected and justified during Plan/Research.
- Public email/password registration is part of the initial API as documented in the contract; new accounts receive only Requester permission. Reviewer membership is provisioned through trusted local seeding. This is a reviewable product assumption for the classroom prototype.
- AI, RAG, MCP, and multi-agent capabilities are outside the initial feature scope.
