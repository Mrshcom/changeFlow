# ChangeFlow

ChangeFlow is an API-only change request workflow for a small, single-instance deployment. Employees
can create and revise requests; an independent Reviewer can approve or return a pending request.

## Stack and architecture

- Next.js 16 App Router Route Handlers with TypeScript on Node.js 22.
- Better Auth 1.7 email/password authentication with database-backed SQLite sessions.
- `better-sqlite3` for local persistence and parameterized application queries.
- Vitest unit tests for domain behavior and route integration tests against temporary file-backed SQLite databases.

Route Handlers handle HTTP input, sessions, status codes, and response headers. Workflow rules live in
`src/lib/domain` and `src/lib/application`. Current role memberships live in `UserRole` and are read
from SQLite for every protected action. Public registration grants only Requester; trusted local
seeding provisions Reviewer and dual-role accounts. A Reviewer cannot decide their own request.

Every request mutation requires the latest strong ETag in `If-Match`. Conditional database updates
protect against stale writes; review decisions and their state changes commit in one transaction.
Approved requests cannot be edited. Requests outside a user's current visibility are returned as
not found.

## Prerequisites and setup

- Node.js 22 LTS and npm 10 or compatible versions.
- A local build environment for the `better-sqlite3` native module.

From the repository root in PowerShell:

```powershell
npm install --legacy-peer-deps
Copy-Item .env.example .env.local
```

Edit `.env.local`: use a random secret of at least 32 characters, a local database path, and
development-only seed credentials. Keep `.env.local` and the SQLite file private; both are ignored
by Git. The seed command creates Requester, Reviewer, and dual-role demo accounts. It never prints
passwords or accepts role assignments from public signup.

Initialize and run the API:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

The API is available at `http://localhost:3000`. Authentication endpoints are provided by Better Auth
under `/api/auth`; request endpoints are documented in
[`specs/001-change-request-workflow/contracts/openapi.yaml`](specs/001-change-request-workflow/contracts/openapi.yaml).

## Validation

```powershell
npm test
npm run lint
npm run build
```

Tests cover persisted workflow state, role checks, visibility, immutable approvals, ETags, and
concurrent writes. See [`docs/validation/session-01.md`](docs/validation/session-01.md) for commands
actually run and their observed results.

## Scope and limits

This initial exercise has no frontend, account-management UI, background worker, or public role
administration endpoint. SQLite is suitable for this low-write, single-instance prototype; the local
database file is not shared across multiple service instances and is not a serverless persistence
solution. If deployment grows beyond that scope, revisit database and hosting choices.

## Coding Agent role

The Coding Agent supports the Spec Kit workflow by translating approved requirements into design
artifacts, dependency-aware tasks, implementation, automated checks, and honest validation records.
It must keep product assumptions reviewable, follow the constitution, and report incomplete work or
unresolved risks. Project maintainers remain responsible for reviewing product decisions and
accepting the delivered behavior; generated code or passing tests alone do not establish acceptance.
