# Quickstart: Change Request Workflow

This guide describes how to install, initialize, run, and validate the implemented API. Actual
validation outcomes are recorded separately in `docs/validation/session-01.md`.

## Prerequisites

- Node.js 22 LTS or newer compatible LTS. The current workstation has Node.js 22.20.0; Next.js 16
  requires Node.js 20.9 or newer.
- npm 10 or compatible.
- A local development environment that can build the `better-sqlite3` native module.

## Setup and Run

From the repository root, after implementation:

```powershell
npm install --legacy-peer-deps
Copy-Item .env.example .env.local
```

Edit `.env.local` to provide a random `BETTER_AUTH_SECRET` of at least 32 characters, the local
SQLite file path, and distinct development seed credentials for Requester, Reviewer, and the dual-role
account. Keep `.env.local` and the SQLite file out of version control. Public signup assigns only
Requester; Reviewer permission comes from trusted local seeding.

Then initialize the database and start the local API:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Expected: the development server starts at `http://localhost:3000`; auth tables and ChangeFlow
tables exist; seed setup provisions demo identities and role memberships without printing or storing
passwords in the repository.

## Validation Commands

```powershell
npm test
npm run lint
npm run build
```

Expected: route integration tests report pass/fail results, lint completes without errors, and the
production build exits successfully. The validation record contains only commands actually run and
observed results.

## End-to-End Scenarios

1. Sign in as a Requester through Better Auth at `/api/auth/sign-in/email`; use the returned session
   cookie for subsequent requests.
2. `POST /api/requests` with title, description, and reason. Expect `201`, state `Draft`, an `ETag`,
   and the authenticated requester identifier.
3. `POST /api/requests/{id}/submit` with the current `If-Match` value. Expect `200` and
   `PendingReview` with a new `ETag`.
4. Sign in as a different Reviewer. `GET /api/requests` returns pending requests; approve or request
   changes using the current `If-Match` value. Expect the corresponding state and a recorded review
   decision. A changes-requested reason may be omitted; if supplied, the requester can read it.
5. Sign in as a user holding both roles and attempt to review their own pending request. Expect a
   rejection and confirm the stored state and review history are unchanged.
6. Submit an edit or review action using an older ETag. Expect `412 Precondition Failed`; confirm
   the latest stored content and state are unchanged.
7. Attempt to edit an approved request or view a request outside the caller's visibility. Expect a
   rejection (`409` for an invalid current state, `404` for an invisible request) and verify no
   stored data changed.

Detailed paths, request shapes, preconditions, and response outcomes are in
[`contracts/openapi.yaml`](contracts/openapi.yaml). Data fields and state transitions are in
[`data-model.md`](data-model.md).
