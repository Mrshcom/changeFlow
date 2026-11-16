<!--
Sync Impact Report
- Version change: 1.0.0 to 1.1.0 (material expansion for the ChangeFlow assignment)
- Modified principles: I. User Value and Clear Scope; III. Secure and Private by Default; IV. Verifiable Quality; V. Reliable Interfaces and Compatible Change
- Added sections: ChangeFlow Product Rules and Scope; SDD and Delivery Evidence
- Removed sections: none
- Follow-up TODOs: Confirm the original ratification date.
-->

# ChangeFlow Constitution

## Core Principles

### I. User Value and Clear Scope
Every change MUST address a stated user need or a documented operational requirement. Product
requirements and acceptance criteria MUST be recorded before implementation. A Coding Agent MUST
not turn an unresolved product question into an unreviewed product decision: it MUST ask for
clarification or record a clearly labeled, reviewable assumption. Technical mechanisms belong in
Plan/Research unless they are themselves a product requirement. Work outside the agreed scope MUST
be recorded separately rather than silently added. This keeps intent distinct from implementation
and makes decisions reviewable.

### II. Simple, Maintainable Design
Implementations MUST use the smallest design that satisfies the requirements. New abstractions,
dependencies, and configuration options MUST have a clear use case documented in the change. Code
and interfaces MUST be understandable to a maintainer who did not author them. This limits needless
complexity and ongoing maintenance cost.

### III. Secure and Private by Default
Changes MUST validate untrusted input at system boundaries, apply least privilege, and avoid
exposing secrets or sensitive data in source, logs, or user-facing errors. Any collection,
retention, or sharing of personal data MUST be necessary for a stated product purpose and
documented. Authorization MUST be checked for every protected operation. For ChangeFlow approvals,
a requester MUST NOT approve their own request, even when they also hold the Reviewer role.
Security-sensitive changes MUST include a review of relevant abuse cases.

### IV. Verifiable Quality
Each change MUST have acceptance criteria that can be checked. Automated checks MUST cover changed
behavior where the project has an applicable test mechanism; otherwise, the change MUST document a
repeatable manual verification. Bug fixes MUST include a check that would detect the reported
regression. Build success and passing tests alone MUST NOT be reported as full validation or
acceptance: required security rules, persisted state, and human-evaluated acceptance criteria MUST
also be checked and reported. Reports MUST reflect commands actually run and results actually
observed. This makes correctness observable and prevents unsupported completion claims.

### V. Reliable Interfaces and Compatible Change
User-facing and internal interfaces MUST behave consistently with their documented contracts.
Changes that break an existing contract MUST identify affected consumers and provide a migration
path or an explicit decision to accept the break. Errors MUST provide enough context for users or
operators to take the next appropriate action without disclosing sensitive implementation data.
ChangeFlow state transitions MUST verify the actor's current identity and authorization, the
request's current state, and any concurrency token required by the chosen persistence design.
Approved requests MUST NOT be edited. Concurrent operations MUST NOT silently overwrite newer
changes or leave the request in an invalid state.

## ChangeFlow Product Rules and Scope

Business logic MUST reside in the Domain or Application layer. Controllers and API endpoints MUST
be limited to receiving requests, invoking application behavior, and returning responses; they
MUST NOT contain business rules. The initial product supports Requester and Reviewer roles and the
Draft, PendingReview, Approved, and ChangesRequested workflow. Requesters can create and edit their
own drafts, submit them, and revise requests returned for changes. Reviewers can approve or return
pending requests. Approved requests are immutable. These rules may change only through an explicit
product requirement and review.

The initial exercise requires an HTTP API and a runnable persistence choice. The technology stack
is open; the selected persistence, authentication/authorization, and concurrency approach MUST be
explained in Research. Frontend, AI, RAG, MCP, and multi-agent capabilities are outside the initial
scope and MUST NOT be added without an approved feature requirement. The repository's established
architecture and tooling MUST be followed unless an approved change records the reason and migration
impact. New runtime dependencies MUST be justified by a concrete requirement. Performance,
availability, accessibility, and regulatory targets MUST be stated in the relevant specification
when material; this constitution does not invent numeric targets.

## SDD and Delivery Evidence

Feature work MUST follow the project's Spec Kit workflow: specify scope and acceptance criteria,
clarify material ambiguities, research and document design choices, create dependency-aware tasks,
analyze the consistency of the artifacts, implement, validate, and converge remaining gaps into
trackable work. Requirements MUST be traceable to acceptance scenarios and implementation tasks.
Technical decisions MUST be supported by relevant research and trade-offs; task coverage alone does
not prove implementation readiness or feature acceptance.

Analyze and Converge findings MUST be handled according to their documented roles: Analyze reviews
specification artifacts, while Converge identifies gaps between documented intent and current
implementation and records follow-up tasks. Neither is evidence that code was fixed. Build, test,
validation, and acceptance results MUST be reported separately. Documentation MUST be updated when
behavior, setup, or operations change. Reviewers MUST record unresolved risks or accepted exceptions
with their owner and rationale.

## Governance

This constitution governs project decisions and supersedes conflicting local conventions. An
amendment MUST explain its rationale, affected principles or sections, and any migration needed for
existing work. Amendments require review by the project maintainers. Version numbers follow
semantic versioning: MAJOR for incompatible governance changes, MINOR for new or materially
expanded principles or sections, and PATCH for clarifications and non-semantic edits. Each change
MUST update the version and last-amended date. Compliance MUST be reviewed during feature planning
and change review; exceptions MUST be explicit, scoped, and justified in the relevant change record.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-11-16
