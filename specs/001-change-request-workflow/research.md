# Research: Change Request Workflow

**Date**: 2026-11-16  
**Scope**: Resolve runtime, API, authentication, persistence, concurrency, and validation choices for the initial ChangeFlow feature.

## Decisions

### 1. Use Next.js App Router Route Handlers as the HTTP API

**Decision**: Implement the API with TypeScript Route Handlers under `src/app/api`, using the
Node.js runtime. Do not add pages or a frontend for this feature.

**Rationale**: The assignment requires an HTTP API and permits an API-only submission. Route
Handlers support public HTTP methods and JSON responses. The Next.js documentation describes this
as a Backend-for-Frontend/API layer and warns that handlers are public endpoints requiring explicit
authentication and authorization. The bounded ChangeFlow prototype has no background jobs,
WebSockets, or other requirements that call for a separate service runtime. The current workstation
has Node.js 22.20.0, which meets Next.js 16's documented Node.js 20.9 minimum.

**Alternatives considered**:

- **Separate Express server**: Rejected because it would add a second server and routing setup when
  Next.js Route Handlers already provide the required HTTP API surface.
- **Separate .NET or Spring service**: Rejected after the project owner selected Next.js for the
  backend.
- **Serverless deployment with local SQLite**: Rejected for this feature because local file
  persistence is not shared across instances and may not be writable on serverless hosts.

### 2. Use Better Auth for authentication and database-backed sessions

**Decision**: Use Better Auth with email/password authentication, database-backed sessions, and its
Next.js Route Handler integration. New accounts receive only the Requester permission by default;
Reviewer permission is provisioned through a trusted seed/admin operation. Do not accept roles from
public signup input. Store role membership separately so a user can hold both roles. For every
protected operation, validate the current session and read current role membership from the database;
do not rely only on a role value cached in a client-controlled or stale session. Check self-review in
the application/domain behavior even for a user who holds both roles.

**Rationale**: Next.js recommends using an authentication library rather than building password
handling and session security from scratch. Better Auth has a documented Next.js Route Handler
integration and persistent SQLite support. The assignment needs independent role membership, current
authorization, and a dual-role self-approval test; a separate role-membership table avoids relying on
one role field. A fresh role lookup also makes revocation effective on the next protected request.

**Alternatives considered**:

- **Custom password/session implementation**: Rejected because it requires maintaining password
  hashing, cookie, session, and CSRF security behavior that an auth library already provides.
- **Next.js Proxy as the only access control**: Rejected. Proxy may perform an early check, but each
  Route Handler must enforce authorization near the data operation; cookie-presence checks do not
  authenticate or authorize a user.
- **Public role selection during signup**: Rejected because it would let a user assign themselves
  Reviewer permission.
- **Better Auth Admin plugin for all application roles**: Rejected because this feature has no
  user-administration UI or general admin role. A small application-owned membership table gives
  the required two roles, dual-role users, and fresh per-request authorization without adding
  privileged admin endpoints.

**Implementation version update**: Use Better Auth 1.7.25 or a compatible patched 1.7.x release.
The initial 1.6.x range was changed after `npm audit --omit=dev` reported a critical advisory in
transitive Better Auth adapter packages. The 1.7.25 package preserves the selected SQLite and
Next.js integration; the authentication, seeding, and role scenarios are covered by integration
tests.

### 3. Use a local SQLite file through `better-sqlite3`

**Decision**: Use a single local SQLite database file. Use Better Auth's documented SQLite adapter
with `better-sqlite3` for identity/session records and parameterized SQL for ChangeFlow tables and
queries. Use versioned SQL migrations for application tables; keep the database file out of version
control.

**Rationale**: SQLite is runnable locally without a separate database server, which fits the
assignment. Better Auth's SQLite guide recommends `better-sqlite3` as its stable Node driver. For
this small data model, parameterized SQL avoids adding an ORM and a second data-access abstraction;
the schema and constraints remain explicit in migration files.

**Alternatives considered**:

- **Node's built-in `node:sqlite`**: Rejected for this plan because the current Better Auth SQLite
  guide labels it Release Candidate, while it describes `better-sqlite3` as stable.
- **Drizzle ORM**: Supported, but not selected because the feature has a small schema and direct
  parameterized SQL is sufficient. Add an ORM only if later features justify its mapping and
  migration layer.
- **PostgreSQL or SQL Server**: Rejected for the initial classroom prototype because they require
  a separately managed service and add setup work without a stated deployment or scale requirement.

### 4. Use application-managed optimistic concurrency and HTTP preconditions

**Decision**: Each Change Request has a new opaque version token after every successful mutation.
Return that token as an `ETag`; require clients to send it as `If-Match` for edits and workflow
transitions. Execute writes conditionally against both the expected version and expected state.
Return `412 Precondition Failed` for a stale token, `428 Precondition Required` when a required
`If-Match` is missing, and `409 Conflict` for a current-version request whose state disallows the
operation. Commit a review decision and its state transition in one SQLite transaction.

**Rationale**: The assignment explicitly requires stale writes not to overwrite newer content.
SQLite does not provide a database-generated version token in this design, so the application owns
the version. A conditional update is simple and testable. HTTP semantics define `If-Match` as a
precondition and use 412 when it evaluates false.

**Alternatives considered**:

- **Last-write-wins updates**: Rejected because they violate FR-011 and can silently erase a newer
  edit.
- **Database-generated row version**: Not selected because SQLite does not provide the same
  database-generated token support as SQL Server `rowversion`; an application-managed token is
  portable for this chosen store.
- **Pessimistic locking**: Rejected because low-volume editing does not justify lock management;
  conditional optimistic writes meet the requirement with less complexity.

### 5. Test the public behavior through Route Handlers and a real SQLite engine

**Decision**: Use Vitest for domain/application tests and route-level integration tests. Integration
tests use a temporary SQLite file and verify both HTTP outcomes and persisted state. Use a test-only
database path and seeded identities/roles; do not use the production development database for tests.

**Rationale**: The key requirements concern end-to-end authorization, state transitions, and
concurrency. Tests must inspect stored state as required by the assignment. A temporary file keeps
SQLite's actual locking and persistence behavior in the test path. Next.js documents Vitest as a
supported test setup; its async Server Component limitation does not apply to this API-only feature.

**Alternatives considered**:

- **Unit tests only**: Rejected because unit tests cannot prove route authorization, persistence, or
  that failed operations leave stored state unchanged.
- **In-memory-only persistence tests**: Rejected as the sole integration setup because the feature
  specifically needs file-backed persistence and concurrent-write behavior to be exercised.

## Operational Notes and Risks

- The current environment has Node.js 22.20.0 and npm 10.9.3; Next.js 16 documents Node.js 20.9 as
  its minimum, and Node.js 22 is currently an LTS release.
- `better-sqlite3` is a native module. Keep all database access in the Node.js runtime and verify
  dependency installation on the target OS during implementation.
- SQLite permits only one active writer at a time. This is acceptable for the assignment's
  low-volume, single-instance scope, but is not a scale-out deployment design.
- Next.js documentation cautions that its API layer is not a complete replacement for a backend
  platform. If the project later needs long-running jobs, shared multi-instance storage, or
  operationally critical service guarantees, revisit the hosting and persistence decisions.
- Role provisioning is server-controlled. A signup request can never specify Reviewer or a role
  list. Reviewer users are created through trusted local seed/admin setup, not a public role-change
  endpoint.

## References

- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth SQLite adapter](https://better-auth.com/docs/adapters/sqlite)
- [Better Auth database and server-owned fields](https://better-auth.com/docs/concepts/database)
- [Better Auth email/password configuration](https://better-auth.com/docs/authentication/email-password)
- [Better Auth Admin roles](https://better-auth.com/docs/1.6/plugins/admin)
- [SQLite isolation](https://www.sqlite.org/isolation.html)
- [Drizzle transactions, considered but not selected](https://orm.drizzle.team/docs/transactions)
- [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
