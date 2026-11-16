# Validation Record — Session 01

**Date**: 2026-11-16  
**Environment**: Windows 10, Node.js 22.20.0, npm 10.9.3  
**Application dependencies**: Next.js 16.4.6, Better Auth 1.7.25, better-sqlite3 12.11.1, Vitest 4.1.12

## Setup and persistence

| Command | Result |
|---|---|
| `npm install --legacy-peer-deps` | Passed; generated/updated `package-lock.json`. Plain `npm install` first failed against the sandbox npm cache and then hit an npm peer-tree resolver error; the documented command completed successfully. |
| `npm run db:migrate` | Passed on the final Better Auth version; applied or confirmed Better Auth and three ChangeFlow migrations. An earlier sandbox-only `tsx` run failed in Windows `os.userInfo`; the final local command completed successfully. |
| `npm run db:seed` | Passed; ensured Requester-only, Reviewer-only, and dual-role local demo accounts. Passwords were not printed. |

The development server loaded the ignored `.env.local` file. A local HTTP smoke flow produced these observed outcomes:

| Action | Result |
|---|---|
| Requester sign-in | `200` |
| Create request | `201`, state `Draft`, ETag returned |
| Submit with current ETag | `200`, state `PendingReview` |
| Reviewer sign-in and pending-list visibility | `200`, pending request visible |
| Approve with current ETag | `200`, state `Approved` |

## Automated checks

| Command | Result |
|---|---|
| `npm test -- --reporter=dot` | Passed: 4 test files, 20 tests. All 20 passed. |
| `npm run lint` | Passed with no errors or warnings. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Passed; Next.js produced the API routes with no build warnings. |
| `npm audit --omit=dev` | Passed: 0 runtime dependency vulnerabilities reported. |

## Remaining dependency finding and acceptance status

Full `npm audit` reports 8 moderate findings in the development-only ESLint/TypeScript-ESLint toolchain, through `minimatch` used by `@typescript-eslint/typescript-estree`. `npm audit fix` did not clear them; npm proposed a forced downgrade of `eslint-config-next` to 15.5.29, which is incompatible with the selected Next.js 16 stack. The runtime dependency audit is clean. **Owner**: project maintainer. **Rationale**: retain compatible Next.js lint tooling and revisit when its dependency range includes the patched parser dependency; do not force a breaking downgrade.

Automated and local HTTP checks passed as reported above. Formal product-owner acceptance and human review of the assignment deliverables have not been performed here, so this record does not claim product acceptance.

## Convergence validation — Domain unit tests

**Date**: 2026-11-16

Added unit tests for required request input parsing and optional return-reason parsing to close the test-strategy gap identified during Converge.

| Command | Result |
|---|---|
| `npm test -- --reporter=dot` | Passed: 6 test files, 36 tests. All 36 passed, including the new domain unit tests. |
| `npx tsc --noEmit` | Passed with no diagnostics. |
