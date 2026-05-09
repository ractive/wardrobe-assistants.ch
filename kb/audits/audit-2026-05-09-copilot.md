---
title: Codebase audit — GitHub Copilot — 2026-05-09
type: audit
status: source
reviewer: github-copilot
created: 2026-05-09
tags: [audit, security, owasp, nextjs, review]
---

# Codebase audit — GitHub Copilot — 2026-05-09

Verbatim output as provided by user 2026-05-09. Preserved as a source document for the consolidated audit.

---

# Audit Report — wardrobe-assistants.ch

## 1. Executive summary

Scope reviewed: monorepo architecture, Next.js 16/React 19 patterns, security, testing, performance/SEO, infra/CI, dependencies.

Commands run:

- `npm ci`
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm test` ✅ (115 tests)
- `npm run build` ✅ (homepage)
- `npm -w @wardrobe-assistants/admin run build` ✅ (with shape-valid env)
- `npm audit --omit=dev` ⚠️ (6 moderate findings)
- `npm outdated` ⚠️ (multiple outdated deps)
- `npm run lighthouse:homepage` ❌ (browser interstitial; no valid score output)

Overall: code quality and test health are strong, but there are notable security hardening and supply-chain risks.

---

## 2. Top 10 highest-risk findings

1. **F-001 (High)** Missing explicit security headers/CSP in both Next apps.
2. **F-002 (High)** CI uses mutable third-party action ref (`@main`).
3. **F-003 (High, medium confidence)** Admin CDN allows caching with cookies; no explicit app-side cache header enforcement found.
4. **F-004 (High)** `seed-temp-admin` script can create admin without 2FA and has no production guard.
5. **F-005 (Medium)** Server actions expose internal error details to users.
6. **F-006 (Medium)** Query layer has no embedded authorization checks (relies on caller discipline).
7. **F-007 (Medium)** `npm audit --omit=dev` reports production-path vulnerabilities (Next/PostCSS + Drizzle/esbuild chain).
8. **F-008 (Medium)** No CodeQL/Dependabot/security scanning workflow detected.
9. **F-011 (Medium)** Admin Docker runtime runs as root (no `USER` hardening).
10. **F-010 (Low)** `useHasPermission` client hook expects `session.user.role`, but role source is DB lookup at permission-check time.

---

## 3. Findings table

| ID | Severity | Category | File(s) | Evidence | Why it matters | Recommended fix | Confidence |
|---|---|---|---|---|---|---|---|
| F-001 | High | Security misconfiguration | `/apps/admin/next.config.ts`, `/apps/homepage/next.config.ts` | Configs define output/compiler only; no `headers()` hardening policy | Missing CSP, frame protections, referrer/permissions policy increases XSS/clickjacking blast radius | Add strict security headers via `next.config.ts` (`Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`) and verify in integration tests | High |
| F-002 | High | Software/data integrity (supply chain) | `/.github/workflows/deploy.yml` | `uses: BunnyWay/actions/container-update-image@main` | Mutable refs can be hijacked/changed unexpectedly | Pin third-party actions to immutable commit SHAs; optionally enforce org policy for SHA pinning | High |
| F-003 | High | Broken access control / sensitive data exposure | `/infra/terraform/pullzones.tf`, `/apps/admin/src/**` | `cache_enabled = true`, `strip_cookies = false`; comment says app must set no-store; no explicit Cache-Control setting found in app code | If responses with cookies/session data are cached, private data can leak cross-user | Enforce `Cache-Control: private, no-store` for authenticated/admin responses at app and/or edge; add regression test and CDN rule fallback | Medium |
| F-004 | High | Identification/auth failures | `/apps/admin/scripts/seed-temp-admin.ts`, `/apps/admin/package.json` | Script explicitly seeds admin **without 2FA**; exposed as `seed:temp-admin` script | Operational misuse can create weak privileged account | Remove script or hard-block outside explicit local/test env; require strong guard (`NODE_ENV!==production`, explicit allow flag) | High |
| F-005 | Medium | Security logging/error handling | `/apps/admin/src/features/users/server/actions.ts`, `/apps/admin/src/features/events/server/actions.ts` | Returns raw `err.message` in user-facing results (invite/profile/email failure paths) | Internal error leakage aids recon and exposes implementation details | Return generic user-safe messages; log structured internal details with correlation IDs | High |
| F-006 | Medium | Broken access control (design) | `/apps/admin/src/features/users/server/queries.ts`, `/apps/admin/src/features/events/server/queries.ts` | Query functions return sensitive records with no built-in permission checks | Future caller may reuse queries without gating, causing accidental data exposure | Add permission-aware wrappers or enforce gated query interfaces at server boundary | High |
| F-007 | Medium | Vulnerable components | `npm audit --omit=dev` output | 6 moderate vulnerabilities reported (`next`/`postcss`, `drizzle-kit` chain) | Known vulns can become exploitable depending on execution context | Triage advisories one-by-one, update safe ranges, document accepted risk for false positives | Medium |
| F-008 | Medium | Security monitoring/governance | `/.github/workflows/*`, `/.github/**` | No Dependabot/CodeQL security workflows detected | Slower detection of vulns and insecure changes | Add Dependabot updates + CodeQL + secret scanning + SARIF upload workflow | High |
| F-009 | Low | Monorepo quality gate hygiene | `/package.json` | Root `verify` omits builds; root `build` builds homepage only | Local pre-commit verification may miss runtime/build regressions in admin | Add `build:all` and include in `verify` (or clearly document CI-only build gate) | High |
| F-010 | Low | Authz consistency / React client logic | `/apps/admin/src/hooks/use-has-permission.ts`, `/apps/admin/src/lib/auth.ts` | Hook reads `session.user.role`; auth comments state role is resolved from `user_profile` at check time | Client-gating hook can misreport permissions if used, causing UI mismatch/confusion | Either enrich session role reliably or have hook call a server-backed permission endpoint | High |
| F-011 | Medium | Container hardening | `/apps/admin/Dockerfile` | No `USER` instruction in runner stage | Running as root increases impact of container compromise | Create non-root user/group and run Node process under it; set filesystem permissions minimally | High |

---

## 4. OWASP coverage matrix

| OWASP area | Status | Notes |
|---|---|---|
| Broken Access Control | ⚠️ | F-003, F-006 |
| Cryptographic Failures | ✅/⚠️ | Good env secret shape validation in `/apps/admin/src/lib/env.ts`; key rotation/session lifetime not fully verifiable |
| Injection | ✅ | Drizzle query builder + Zod boundaries; no obvious SQL/command injection path found |
| Insecure Design | ⚠️ | F-006, F-010 |
| Security Misconfiguration | ⚠️ | F-001, F-011 |
| Vulnerable/Outdated Components | ⚠️ | F-007, outdated deps present |
| Identification & Authentication Failures | ⚠️ | F-004 |
| Software & Data Integrity Failures | ⚠️ | F-002 |
| Security Logging & Monitoring Failures | ⚠️ | F-005, F-008 |
| SSRF | ✅ | No user-controlled outbound fetch paths found in app code |

---

## 5. Next.js 16 best-practices checklist

- App Router conventions: **Pass**
- RSC vs client boundaries: **Mostly pass**
- Server Actions authz + validation: **Pass with caveat** (error leakage in F-005)
- CSRF/origin policy: **Not fully verifiable**
- `loading/error/not-found` boundaries: **Partial**
- Caching/revalidation: **Partial risk** (F-003)
- `next.config` hardening/perf: **Needs work** (F-001)
- Image/font/script optimization: **Mixed** (external font stylesheet in root layout)
- Link/prefetch patterns: **Mixed** (some plain `<a>` internal links by design)
- React Compiler assumptions: **Pass**

---

## 6. shadcn/ui accessibility and design-system checklist

- `components.json` configured: **Pass** (`/apps/admin/components.json`)
- Alias consistency: **Pass**
- CSS variables/tokens: **Pass**
- Primitive accessibility after customization: **Mostly pass**
- Form labeling/errors: **Pass** in reviewed dialogs/forms
- Keyboard/screen-reader behavior: **Mostly pass**
  - Note: mobile nav checkbox/label pattern lacks explicit `aria-expanded` sync
- Drift risk in copied primitives without dedicated a11y tests: **Present**

---

## 7. Testing gaps

- Strong unit + smoke coverage for admin permissions/actions.
- Gaps:
  - No CSP/security-header assertions.
  - No explicit tests for cache headers on authenticated responses.
  - No rate-limit/abuse tests (login/reset/invite/message).
  - No coverage thresholds.
  - No CI browser/e2e for critical auth+permission flows.

---

## 8. Performance/SEO gaps

- Lighthouse script failed in this environment (interstitial), so no verified score output.
- Homepage uses external font stylesheet link in root layout (render-blocking risk vs `next/font`).
- No CI-enforced Lighthouse budget gate.
- Sitemap/robots/structured metadata are present and generally strong.
- `sitemap.ts` uses runtime `new Date()` for `lastModified` (weaker signal than content-driven timestamps).

---

## 9. Dependency and supply-chain risks

- `npm audit --omit=dev`: 6 moderate findings.
- `npm outdated`: multiple patch/minor updates available (React, Tailwind, Lighthouse, etc.).
- CI action pinning risk due mutable ref (F-002).
- No automated dependency/security update workflow found (F-008).

---

## 10. Suggested follow-up tasks (ordered by risk/effort)

1. **(High risk, low effort)** Pin all GitHub Actions to immutable commit SHAs.
2. **(High risk, medium effort)** Add strict security headers/CSP for both apps and test them.
3. **(High risk, medium effort)** Enforce admin `Cache-Control: private, no-store` + CDN fallback rules; add tests.
4. **(High risk, low effort)** Remove or hard-gate `seed-temp-admin` from production paths.
5. **(Medium risk, low effort)** Sanitize server-action user-facing errors.
6. **(Medium risk, medium effort)** Add permission-aware query wrappers/policy-enforced data access.
7. **(Medium risk, medium effort)** Add CodeQL + Dependabot + secret scanning workflows.
8. **(Medium risk, low effort)** Harden admin Docker runtime to non-root user.
9. **(Medium risk, medium effort)** Triage/remediate audit advisories and document accepted risk where needed.
10. **(Low risk, low effort)** Align root verify/build scripts with true monorepo runtime gates.
