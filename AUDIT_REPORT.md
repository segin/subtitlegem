# Comprehensive Codebase Audit Report: SubtitleGem

**Date:** February 3, 2026
**Commit:** Head (Draft State)
**Auditor:** Agent Jules

## 1. Executive Summary

A comprehensive audit of the SubtitleGem codebase was performed to identify security, correctness, and maintainability risks. The audit covered all source code, configuration, and dependencies.

**Overall Health Score: 75/100**
(Deductions for Critical Security Vulnerability, compilation errors, and missing CI gates)

**Top Risks:**
1.  **[CRITICAL] Path Traversal / Arbitrary File Read:** The `isPathSafe` utility explicitly allowed access to the project root, enabling potential exfiltration of source code and secrets via API endpoints. **(FIXED)**
2.  **[HIGH] Vulnerable Dependency:** `next` v16.1.1 contained high-severity DoS vulnerabilities. **(FIXED)**
3.  **[MEDIUM] Missing CI Security Gates:** The CI pipeline does not enforce security scanning (SCA/Secrets).
4.  **[MEDIUM] Type Safety:** Compilation was broken due to mismatched types, and strict mode usage is inconsistent (many `any` types). **(PARTIALLY FIXED)**
5.  **[LOW] Linting Debt:** Over 400 linting warnings indicate a need for code quality cleanup.

## 2. Methodology

The audit followed a rigorous process:
1.  **Discovery:** Enumerated 172 files, 40k+ LOC (mostly TypeScript/TSX).
2.  **SCA:** Analyzed dependencies using `npm audit`.
3.  **Secrets:** Scanned for regex patterns of common keys (None found).
4.  **SAST:** Ran ESLint and TypeScript Compiler. Manual review of dangerous patterns (`fs`, `child_process`).
5.  **Runtime:** Executed 61 Test Suites. Found 1 failure related to the Critical security issue.
6.  **Remediation:** Applied fixes for Critical/High issues and verified with tests.

## 3. Metrics & Baseline

-   **Total Files:** 172
-   **Languages:** TypeScript (15.4k LOC), TSX (13.5k LOC), JSON (12k LOC).
-   **Test Coverage:** 61 Test Suites (100% Passing after fixes).
-   **Dependencies:** 2 Vulnerabilities found initially (Next.js, diff).
-   **Complexity:** Modular architecture, but high complexity in `ffmpeg-concat.ts` and `queue-manager.ts`.

## 4. Detailed Findings

### Security

#### SEC-001: Path Traversal / Arbitrary File Read (Fixed)
-   **Severity:** Critical
-   **Location:** `src/lib/storage-config.ts`
-   **Description:** The `isPathSafe` function allowed `resolvedPath.startsWith(projectRoot)`. This allowed API inputs to reference files outside the intended `storage` directory, such as `.env` or source files.
-   **Remediation:** Removed `projectRoot` from the allowed paths list. Only `stagingDir` is now permitted.

#### SEC-002: Vulnerable Dependency (Fixed)
-   **Severity:** High
-   **Location:** `package.json`
-   **Description:** `next@16.1.1` was flagged for GHSA-h25m-26qc-wcjf (DoS).
-   **Remediation:** Upgraded to `next@16.1.6`.

#### SEC-003: Missing CI/CD Security Gates (Open)
-   **Severity:** Medium
-   **Location:** `.github/workflows/ci.yml`
-   **Description:** CI only runs `lint` and `test`. Vulnerabilities introduced in dependencies or secrets committed to code would not be blocked.
-   **Remediation:** Add `npm audit` and a secret scanning tool (e.g., TruffleHog) to the workflow.

### Correctness

#### COR-001: TypeScript Compilation Errors (Fixed)
-   **Severity:** Medium
-   **Location:** `src/components/ExportControls.tsx`, `src/types/subtitle.ts`
-   **Description:** `FFmpegConfig` type definition was missing the `codec` property required by `ExportConfig`. Tests were also failing due to read-only `NODE_ENV` assignment.
-   **Remediation:** Updated types and fixed test mocking logic.

#### COR-002: Linting Violations (Open)
-   **Severity:** Low
-   **Location:** Various
-   **Description:** 400+ ESLint issues, primarily unused variables and `any` usage.
-   **Remediation:** Schedule a "cleanup sprint" to resolve these.

## 5. Architecture & Design

The application follows a clean Next.js App Router structure.
-   **Frontend:** React/Tailwind.
-   **Backend:** Next.js API Routes + SQLite (Draft Store).
-   **Processing:** Native `child_process` wrapping FFmpeg.
-   **AI:** Google Gemini integration.

**Observation:** usage of `fs.*Sync` methods in API routes (e.g., `src/app/api/process/route.ts`) can block the Node.js event loop, potentially affecting performance under load. Recommendation: Migrate to `fs.promises`.

## 6. Conclusion & Next Steps

The critical security hole has been plugged, and the build is now stable. The codebase is in a much healthier state.

**Immediate Actions:**
1.  Merge the `REMEDIATION.patch`.
2.  Review and merge the `audit-findings.json` into the project's issue tracker.
3.  Configure CI to prevent regression of the security posture.
