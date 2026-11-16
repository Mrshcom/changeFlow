---
description: "Dependency-ordered implementation tasks for Change Request Workflow"
---

# Tasks: Change Request Workflow

**Input**: Design documents from `specs/001-change-request-workflow/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Include automated test tasks because Assignment.md explicitly requires them. Add tests before their story implementation and verify the expected failure before implementing that behavior.

**Organization**: Tasks are grouped by user story. Story phases follow priority while respecting the workflow dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks because it uses different files and has no dependency on unfinished tasks.
- **[Story]**: Maps story tasks to `spec.md` user stories.
- Every implementation task names its target file path.

## Phase 1: Setup

**Purpose**: Initialize the API-only Next.js project and development configuration.

- [X] T001 Initialize the Next.js 16 App Router TypeScript project at the repository root in `package.json`, `tsconfig.json`, and `next.config.ts`, without adding a frontend page.
- [X] T002 Add compatible stable Next.js, Better Auth, `better-sqlite3`, TypeScript, Vitest, and `tsx` dependencies plus `dev`, `build`, `test`, `db:migrate`, and `db:seed` scripts in `package.json` and `package-lock.json`.
- [X] T003 [P] Configure the project lint rules for TypeScript and App Router files in `eslint.config.mjs`.
- [X] T004 [P] Add local environment variable examples and ignore `.env.local` and SQLite database files in `.env.example` and `.gitignore`.

---

## Phase 2: Foundational

**Purpose**: Complete shared persistence, identity, role, error, and test infrastructure required by every story.

**Checkpoint**: No story implementation starts until the shared foundation is available.

- [X] T005 Create a Node-runtime SQLite connection singleton that reads its database path from environment configuration in `src/lib/db/connection.ts`.
- [X] T006 Configure Better Auth email/password accounts and database-backed sessions in `src/lib/auth/auth.ts`, and expose its Next.js handler in `src/app/api/auth/[...all]/route.ts`.
- [X] T007 [P] Define consistent Problem Details responses for validation, authorization, missing resources, and conflicts in `src/lib/http/problem-details.ts`.
- [X] T008 Create the `UserRole` table with a composite `(userId, role)` key, `role` restricted to `Requester` or `Reviewer`, and UTC `createdAt` in `src/lib/db/migrations/0001_user_roles.sql`; implement current database role lookup and server-only role assignment in `src/lib/auth/authorization.ts`.
- [X] T009 Implement ordered Better Auth/application schema migrations and environment-driven demo account seeding for Requester, Reviewer, and dual-role users in `scripts/db/migrate.ts` and `scripts/db/seed.ts`; public signup must never accept role membership.
- [X] T010 Configure Vitest and temporary file-backed SQLite fixtures, including helpers to provision test users and roles without using the development database, in `vitest.config.ts` and `tests/helpers/database.ts`.

---

## Phase 3: User Story 1 - Submit a Change Request (Priority: P1) 🎯 MVP

**Goal**: A Requester creates a Draft, edits their own Draft, and submits a complete request for review.

**Independent Test**: Create a request as a seeded Requester, confirm it is persisted as `Draft`, edit its details, submit it, and confirm it is persisted as `PendingReview`; blank required text must be rejected.

### Tests for User Story 1

- [X] T011 [US1] Add integration tests for creating, reading only owner-visible requests, editing, and submitting a request; missing/whitespace-only required fields; expected HTTP results; ETag and `If-Match` behavior (including missing and stale preconditions); and persisted state in `tests/integration/requests-create-submit.test.ts`; run the new tests and confirm the behavior fails before implementation.

### Implementation for User Story 1

- [X] T012 [P] [US1] Add the ChangeRequest table in `src/lib/db/migrations/0002_change_requests.sql` with UUID `id`, required trimmed nonblank `title`, `description`, and `reason`, immutable required `requesterId` foreign key, status limited to `Draft`, `PendingReview`, `Approved`, or `ChangesRequested`, required UUID `version`, UTC `createdAt` and `updatedAt`, and requester/status list indexes.
- [X] T013 [P] [US1] Define ChangeRequest fields, exact status values, and required trimmed nonblank title/description/reason validation in `src/lib/domain/change-request.ts`.
- [X] T014 [US1] Implement Requester-owned Draft creation, Draft editing, required-field validation, and Draft-to-PendingReview submission; require the expected current version for every update and submission and apply state/version changes atomically in `src/lib/application/change-request-service.ts`.
- [X] T015 [US1] Implement authenticated request creation/list/detail and Draft update/submit Route Handlers with owner-only list/detail visibility, strong response ETags, required `If-Match` on update/submit, and documented response shapes; add shared ETag/precondition handling in `src/lib/http/preconditions.ts` and handlers in `src/app/api/requests/route.ts`, `src/app/api/requests/[requestId]/route.ts`, and `src/app/api/requests/[requestId]/submit/route.ts`.

**Checkpoint**: US1 can be demonstrated independently; requests reach `PendingReview`, but review decisions arrive in US2.

---

## Phase 4: User Story 2 - Review a Pending Request (Priority: P1)

**Goal**: An independent Reviewer approves a pending request or returns it for changes, optionally providing a reason.

**Independent Test**: Use seeded pending requests to approve one and return another; verify the stored state and decision record. A self-review attempt and a user without Reviewer permission must be rejected.

### Tests for User Story 2

- [X] T016 [US2] Add integration tests for approve, request changes with and without a reason, self-review rejection even for dual-role users, non-Reviewer rejection, and persisted decision/state in `tests/integration/requests-review.test.ts`; run the new tests and confirm the behavior fails before implementation.

### Implementation for User Story 2

- [X] T017 [P] [US2] Add the ReviewDecision table in `src/lib/db/migrations/0003_review_decisions.sql` with UUID `id`, required request/reviewer foreign keys, decision limited to `Approved` or `ChangesRequested`, nullable optional `reason`, UTC `decidedAt`, and `(requestId, decidedAt)` index.
- [X] T018 [P] [US2] Define ReviewDecision fields and the exact `Approved`/`ChangesRequested` decision values, with an optional reason, in `src/lib/domain/review-decision.ts`.
- [X] T019 [US2] Implement reviewer authorization, requester/reviewer identity inequality, PendingReview-only transitions, expected-version checks, and one-transaction conditional decision plus request updates in `src/lib/application/review-service.ts`.
- [X] T020 [US2] Implement approve and request-changes Route Handlers with required `If-Match` and response ETags; permit requesters to see their own requests and Reviewers to see only `PendingReview` requests, and include append-only review history, reviewer identity, decision time, and any supplied optional reason in visible request details in `src/app/api/requests/[requestId]/approve/route.ts`, `src/app/api/requests/[requestId]/request-changes/route.ts`, `src/lib/application/request-query-service.ts`, and `src/app/api/requests/[requestId]/route.ts`.

**Checkpoint**: Review decisions persist and the request workflow can reach both terminal approval and requester revision.

---

## Phase 5: User Story 4 - Protect Request State and Concurrent Changes (Priority: P1)

**Goal**: Enforce visibility, current authorization, immutable approval, and stale-write protection for every protected request operation.

**Independent Test**: With seeded identities and requests, verify inaccessible requests are hidden, role revocation takes effect, approved content is unchanged after rejected edits, self-review is rejected, and stale writes do not replace newer data.

### Tests for User Story 4

- [X] T021 [US4] Add integration tests for requester/reviewer visibility, dual-role visibility, current-role revocation, approved-request immutability, missing/stale `If-Match`, stale concurrent edits, and concurrent reviewer transitions in `tests/integration/requests-protection.test.ts`; assert stored rows and review history remain unchanged after rejection and confirm tests fail before implementation.

### Implementation for User Story 4

- [X] T022 [US4] Audit and complete list/detail visibility as the union of the caller's own requests and Reviewer-visible `PendingReview` requests, returning `404` outside that set; ensure the same policy is used by every query path in `src/lib/application/request-query-service.ts`, `src/app/api/requests/route.ts`, and `src/app/api/requests/[requestId]/route.ts`.
- [X] T023 [US4] Enforce current role lookup and ownership for each protected operation, reject every self-review, and prevent any mutation of `Approved` requests in `src/lib/auth/authorization.ts`, `src/lib/application/change-request-service.ts`, and `src/lib/application/review-service.ts`.
- [X] T024 [US4] Audit every mutation path and complete atomic expected-version plus current-state enforcement, returning `428` for missing preconditions, `412` for stale versions, and `409` for disallowed current states; close any gaps in `src/lib/application/change-request-service.ts`, `src/lib/application/review-service.ts`, and the related Route Handlers. Keep the guards introduced with each endpoint in T015 and T020; this task completes cross-route coverage rather than deferring initial protection.

**Checkpoint**: Every protected route enforces current visibility, permission, state, and version rules without silent overwrites.

---

## Phase 6: User Story 3 - Revise and Resubmit a Returned Request (Priority: P2)

**Goal**: A Requester edits a `ChangesRequested` request and resubmits it while retaining the review history.

**Independent Test**: Start with a seeded returned request, edit it as its owner, verify it remains `ChangesRequested`, resubmit it, and verify it becomes `PendingReview` with its previous decision and optional reason still available.

### Tests for User Story 3

- [X] T025 [US3] Add integration tests for owner edits to `ChangesRequested`, unchanged state before resubmission, successful resubmission, rejection of another user's edit, optional reviewer reason visibility, and retained history in `tests/integration/requests-resubmit.test.ts`; run the new tests and confirm the behavior fails before implementation.

### Implementation for User Story 3

- [X] T026 [US3] Extend the request application service to permit only the owner to edit a `ChangesRequested` request while retaining that state until resubmission in `src/lib/application/change-request-service.ts`.
- [X] T027 [US3] Extend submission to accept a complete owner-owned `ChangesRequested` request, transition it to `PendingReview`, advance the version, and retain prior ReviewDecision records in `src/lib/application/change-request-service.ts` and `src/app/api/requests/[requestId]/submit/route.ts`.

**Checkpoint**: Returned requests complete a full review-and-revision cycle without losing the prior review record.

---

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Finish project documentation and capture real validation evidence required by the assignment.

- [X] T028 [P] Document the selected Next.js stack, architecture, authentication/role provisioning, setup/run instructions, known SQLite/single-instance limits, and Coding Agent role in `README.md`.
- [X] T029 [P] Reconcile the planned setup, migration, seed, run, test, and build commands with the implemented scripts and contract scenarios in `specs/001-change-request-workflow/quickstart.md`.
- [X] T030 Run the completed quickstart, `npm test`, and `npm run build`; record the exact commands, test count, actual outcomes, and any remaining failures without fabrication in `docs/validation/session-01.md`.
- [X] T031 [P] Answer the five conceptual questions from Assignment.md in Persian, using the project decisions as examples, in `docs/answers/session-01.md`.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Complete T001-T004 first.
- **Foundational (Phase 2)**: Starts after Setup and blocks every user story.
- **US1 (Phase 3)**: Starts after Foundation; creates the request entity and first transitions.
- **US2 (Phase 4)**: Depends on US1 request schema and service so it can review persisted pending requests.
- **US4 (Phase 5)**: Depends on US1 and US2 endpoints and data so it can enforce visibility and concurrency across all mutations.
- **US3 (Phase 6)**: Depends on US2's `ChangesRequested` state and US4's mutation/version guards.
- **Polish (Phase 7)**: Depends on the stories selected for delivery; validation evidence is captured after implementation.

### User Story Dependencies

- **US1 (P1)**: No user-story dependency; requires Foundation.
- **US2 (P1)**: Requires US1's request entity and PendingReview state; can be tested using seeded requests.
- **US4 (P1)**: Requires request and review operations from US1 and US2; fixtures keep its tests independently repeatable. US1 and US2 establish baseline visibility and version guards when their endpoints are introduced; US4 audits and completes coverage across all routes.
- **US3 (P2)**: Requires the US2 return-for-changes transition and US4's concurrency/authorization behavior.

### Parallel Opportunities

- T003 and T004 can run in parallel after T001-T002 because they edit separate configuration files.
- T007 can run in parallel with T005-T006 because HTTP error formatting does not depend on persistence or auth configuration.
- T012 and T013 can run in parallel after T011 because the SQL schema and domain type are separate files with requirements already specified in `data-model.md`.
- T017 and T018 can run in parallel after T016 and T012 because the review SQL schema and TypeScript decision type are separate files.
- T028 and T029 can run in parallel after implementation because they update separate documentation files.
- User story implementation phases are not fully parallel: the review state depends on submitted requests, protection spans existing route/services, and resubmission depends on returned requests.

## Parallel Example: User Story 1

```text
After T011 is written and its expected failures are confirmed, run these independent tasks in parallel:
Task: T012 Add the ChangeRequest SQL migration in src/lib/db/migrations/0002_change_requests.sql
Task: T013 Define the ChangeRequest domain model in src/lib/domain/change-request.ts

Then complete sequentially:
Task: T014 Implement request behavior in src/lib/application/change-request-service.ts
Task: T015 Implement request Route Handlers in src/app/api/requests/...
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational tasks.
2. Complete US1 to demonstrate create, edit, and submit behavior.
3. Treat US1 as a technical MVP slice only; the assignment workflow is not complete until US2 approval/return and US4 protection are implemented.

### Incremental Delivery

1. Complete Setup + Foundation.
2. Add US1 request creation/submission.
3. Add US2 review decisions.
4. Add US4 visibility and concurrency safeguards.
5. Add US3 requester revision/resubmission.
6. Run the quickstart and record actual test/build evidence.

## Notes

- Every task uses the required checkbox, sequential ID, optional `[P]`, story label where required, and explicit file path.
- `[P]` indicates independent files with no unfinished-task dependency.
- Tests are included because Assignment.md explicitly requires automated workflow and persisted-state checks; no tests are run by this task-generation step.
- Keep role assignment server-controlled; never seed or log real passwords in source control.

## Phase 8: Convergence

**Purpose**: Close the remaining gap between the planned test strategy and the implemented test suite.

- [X] T032 [P] Add unit tests for valid input trimming, missing fields, and whitespace-only required fields in `parseRequestInput` in `tests/unit/change-request.test.ts`, as specified by the plan's domain testing strategy (partial).
- [X] T033 [P] Add unit tests for omitted, null, blank, non-string, and supplied reasons in `parseReturnReason` in `tests/unit/review-decision.test.ts`, as specified by the plan's domain testing strategy (partial).
