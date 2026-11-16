# Implementation Plan: Change Request Workflow

**Branch**: `001-change-request-workflow` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-change-request-workflow/spec.md`

## Summary

Build a small, API-only ChangeFlow service for submitting and reviewing change requests. Use
Next.js App Router Route Handlers with TypeScript, Better Auth for account sessions, and a local
SQLite database. Keep business rules in application/domain modules; use a current-role lookup and
an explicit requester-versus-reviewer check for authorization. Use an application-managed version
and conditional state changes so stale writes cannot overwrite newer data.

## Technical Context

**Language/Version**: TypeScript on Node.js 22 LTS (local environment: Node 22.20.0).

**Primary Dependencies**: Next.js 16 App Router, Better Auth 1.6.x, `better-sqlite3`, and
TypeScript. Use the Better Auth SQLite integration for identity/session storage and parameterized
SQL for the small ChangeFlow data model. Pin compatible stable versions in the lockfile during
implementation.

**Storage**: A local SQLite database file. Keep it outside source control. Use Better Auth's
supported SQLite schema migration for identity/session tables and a versioned SQL migration for
ChangeFlow tables.

**Testing**: Vitest for domain and application behavior, plus route-level integration tests using
temporary SQLite database files. Include authorization, persisted-state, workflow, and stale-version
scenarios required by the spec. Tests are planned here; no tests have been run in this planning phase.

**Target Platform**: Self-hosted Node.js server on Windows, macOS, or Linux. Node.js 22.20.0 is
available in the current environment and meets Next.js 16's documented minimum of Node.js 20.9.
Use the Node runtime for handlers that access SQLite.

**Project Type**: API-only web service; no frontend is required.

**Performance Goals**: No numeric latency or throughput target is specified for the classroom
prototype. Correct state transitions and data integrity take priority.

**Constraints**: One deployable Next.js service and one local SQLite file; no external identity
provider, frontend, AI, RAG, MCP, or multi-agent feature. Route Handlers are public HTTP entry points,
so every handler MUST validate input, session, current role, ownership, and state close to the data
operation. Keep the deployment self-hosted and single-instance; do not rely on a serverless host's
ephemeral or non-shared filesystem for SQLite.

**Scale/Scope**: Small, single-instance classroom prototype with low write volume. No production
availability, multi-region, or high-throughput requirement is defined.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Constitution rule | Plan decision | Gate |
|---|---|---|
| Business rules belong in Domain/Application, not API endpoints | Route Handlers validate/translate HTTP and call application services; state transitions and self-review checks live in domain/application modules. | PASS |
| Use the smallest maintainable design | One Next.js application, focused modules, a small SQL schema, and no repository abstraction or extra service. | PASS |
| Check current identity and authorization; prohibit self-review | Better Auth validates the session; each protected operation loads current role membership from storage, checks ownership/visibility, and rejects requester/reviewer identity matches for review actions. | PASS |
| Protect approved data and concurrent updates | Approved requests are immutable; every mutation checks allowed current state and an expected version, and review decision plus state transition are atomic. | PASS |
| Verify behavior and report evidence honestly | Plan includes route integration and persistence checks; implementation reports only checks actually run. | PASS |
| Keep scope bounded | No frontend or out-of-scope AI/RAG/MCP/multi-agent features; persistence and runtime fit the assignment. | PASS |

**Gate result**: PASS before research. No constitution exception is required. Re-check after design:
PASS; the artifacts below preserve the same constraints.

## Project Structure

### Documentation (this feature)

```text
specs/001-change-request-workflow/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md              # Created by $speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
src/
├── app/
│   └── api/
│       ├── auth/[...all]/route.ts
│       └── requests/
│           ├── route.ts
│           └── [requestId]/
│               ├── route.ts
│               ├── submit/route.ts
│               ├── approve/route.ts
│               └── request-changes/route.ts
└── lib/
    ├── domain/change-request.ts
    ├── domain/review-decision.ts
    ├── application/change-request-service.ts
    ├── application/review-service.ts
    ├── application/request-query-service.ts
    ├── application/errors.ts
    ├── auth/auth.ts
    ├── auth/auth-options.ts
    ├── auth/authorization.ts
    ├── db/connection.ts
    ├── db/migrations/
    ├── http/preconditions.ts
    └── http/problem-details.ts

scripts/
└── db/{migrate,seed}.ts

tests/
├── helpers/database.ts
├── unit/
└── integration/

docs/
└── validation/
```

**Structure Decision**: Use one Next.js App Router project with public Route Handlers under
`src/app/api`. Keep HTTP concerns in handlers, business rules in `domain` and `application`, and
identity/database setup in `lib`. A single deployable project is sufficient for this assignment;
separate backend projects and a generic repository layer would add structure without solving a
current requirement.

## Complexity Tracking

No constitution violations or complexity exceptions are proposed.
