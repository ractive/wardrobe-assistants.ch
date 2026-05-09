---
title: Codebase audit — consolidated (Claude + ChatGPT + Copilot) — 2026-05-09
type: audit
status: current
reviewers: [claude-opus-4-7, chatgpt, github-copilot]
created: 2026-05-09
tags: [audit, security, owasp, nextjs, review, consolidated]
related: [audit-2026-05-09-claude-opus.md, audit-2026-05-09-chatgpt.md, audit-2026-05-09-copilot.md, ../admin-architecture/decision-log.md]
---

# Consolidated codebase audit — 2026-05-09

Three independent reviews of the Next.js 16 monorepo (Claude Opus 4.7, ChatGPT, GitHub Copilot), consolidated and reconciled. Source documents are preserved verbatim alongside this file. New claims from Copilot and ChatGPT were verified by re-reading the cited code; any that didn't survive verification are called out under "Disputed / overstated".

## 1. Reviewer-coverage matrix

Where each reviewer caught (or missed) the substantive findings. ✅ = called out clearly; ⚠️ = mentioned weakly or only via a checklist row; ❌ = missed.

| # | Finding (consolidated ID) | Sev | Claude | ChatGPT | Copilot |
|---|---|---|---|---|---|
| 1 | C-SEC-01 No security headers / CSP in admin (and homepage) | H | ✅ S-16 | ✅ MEDIUM | ✅ F-001 |
| 2 | C-SEC-02 No rate limiting on Better Auth endpoints | H | ✅ S-24 | ⚠️ "abuse protection" | ⚠️ test gap |
| 3 | C-SEC-03 GitHub Actions `@main` mutable ref (BunnyWay/actions/container-update-image) | H | ❌ | ✅ HIGH | ✅ F-002 |
| 4 | C-SEC-04 Admin pull-zone caches with cookies, no app-side `Cache-Control` | H | ❌ | ❌ | ✅ F-003 |
| 5 | C-SEC-05 `seed-temp-admin` script lacks production guard, seeds without 2FA | H | ❌ | ❌ | ✅ F-004 |
| 6 | C-SEC-06 Container runs as root | H | ✅ I-03 | ❌ | ✅ F-011 |
| 7 | C-SEC-07 Email header injection in `messageUser` (CR/LF in subject not stripped) | M-H | ✅ S-25 | ❌ | ❌ |
| 8 | C-SEC-08 Raw `err.message` exposed in user-facing action results & email failure | M | ❌ | ✅ MEDIUM | ✅ F-005 |
| 9 | C-SEC-09 Query-layer authorization is route-only; no defense-in-depth | M | ❌ | ✅ MEDIUM | ✅ F-006 |
| 10 | C-SEC-10 No audit logging for sensitive actions | M | ✅ S-19 | ⚠️ in OWASP weak areas | ❌ |
| 11 | C-SEC-11 Outdated transitive deps (esbuild via better-auth/drizzle-kit; postcss via next) | M | ✅ D-03 | ❌ | ✅ F-007 |
| 12 | C-SEC-12 No automated security scanning (Dependabot / CodeQL / Trivy / secret scan) | M | ⚠️ "follow-up #14" | ✅ MEDIUM | ✅ F-008 |
| 13 | C-SEC-13 Missing `user_profile` silently denies all permissions; no regression test | M | ✅ S-04 | ❌ | ❌ |
| 14 | C-NXT-01 No `error.tsx` / `not-found.tsx` boundaries | M | ✅ B-04 | ❌ | ⚠️ "Partial" |
| 15 | C-CI-01 CI runs `typecheck` + `test` but **not** `lint` | M-H | ❌ | ✅ HIGH | ⚠️ implied via F-009 |
| 16 | C-INF-01 No down-migration / rollback runbook | M | ✅ I-05 | ❌ | ❌ |
| 17 | C-TST-01 Email injection / `messageUser` happy path not in smoke suite | M | ✅ T-06 | ❌ | ⚠️ "no rate-limit/abuse tests" |
| 18 | C-NXT-02 Homepage uses external font stylesheet (`<link>` to fonts.bunny.net), not `next/font` | L-M | ❌ (called out as positive E-06) | ❌ | ✅ "render-blocking risk" |
| 19 | C-AUTH-01 `requireEmailVerification: false` — undocumented onboarding decision | L | ❌ | ✅ LOW | ❌ |
| 20 | C-MONO-01 Root `build` only builds homepage; root `verify` doesn't include any build | L | ❌ | ❌ | ✅ F-009 |
| 21 | C-AUTHZ-01 `useHasPermission` hook reads `session.user.role` cast (Better Auth doesn't set role on session) | L | ✅ C-01 (Info) | ❌ | ✅ F-010 (Low) |
| 22 | C-A11Y-01 Mobile-nav checkbox/label pattern lacks `aria-expanded` sync | L | ❌ | ❌ | ✅ shadcn checklist note |
| 23 | C-DEP-01 Easy patch bumps available (react 19.2.6, tailwind 4.3.0, resend 6.12.3) | L | ✅ D-04 | ❌ | ✅ "outdated deps" |
| 24 | C-TS-01 `skipLibCheck: true` hides upstream type bugs | L | ❌ | ✅ LOW | ❌ |
| 25 | C-TS-02 `EventForm` casts `undefined as unknown as Date` | L | ✅ C-02 | ❌ | ❌ |
| 26 | C-MONO-02 `zod` not declared in `packages/db` | L | ✅ A-01 | ❌ | ❌ |
| 27 | C-SEO-01 `sitemap.ts` uses `new Date()` for `lastModified` | I | ❌ | ❌ | ✅ |
| 28 | C-SEC-14 No `trustedOrigins` in Better Auth config | L | ✅ S-18 | ❌ | ❌ |
| 29 | C-SEC-15 Min password length 8; ADMIN justifies higher | L | ✅ S-08 | ❌ | ❌ |
| 30 | C-OPS-01 No CI Lighthouse budget gate | L | ✅ E-01 | ❌ | ✅ |

Reviewer score (substantive issues caught, weighted by severity):

- **Copilot** caught the most operational/infra issues (F-002, F-003, F-004 — all High and all real) and ran the build pipeline locally, which gave it concrete evidence Claude had to work around.
- **ChatGPT** caught the CI-lint gap, `requireEmailVerification`, and `skipLibCheck` — quieter but useful policy issues.
- **Claude** caught the most app-logic issues (S-25 email header injection, S-04 missing-profile denial, S-25/T-06 test gaps, A-01 zod dep), and was the only one that re-ran `npm audit` and corrected severity (Copilot/ChatGPT both used "production-path vulnerabilities" without distinguishing dev-server-only `esbuild` advisory from real runtime risk).
- All three converged on the four real high-severity issues: security headers (#1), supply chain (#3), CDN caching (#4), and container hardening (#6).

## 2. Top 12 highest-risk findings (consolidated)

| Rank | ID | Sev | Title |
|---|---|---|---|
| 1 | C-SEC-04 | **H** | Admin pull-zone caches authenticated responses with cookies; no app-side `Cache-Control: private, no-store` |
| 2 | C-SEC-01 | **H** | No security headers / CSP in admin (and homepage) |
| 3 | C-SEC-03 | **H** | `BunnyWay/actions/container-update-image@main` — mutable upstream Action ref in deploy workflow |
| 4 | C-SEC-05 | **H** | `seed-temp-admin.ts` seeds an admin without 2FA and has no production guard; exposed as `seed:temp-admin` |
| 5 | C-SEC-02 | **H** | No rate limiting on login / password-reset / invite endpoints |
| 6 | C-SEC-06 | **H** | Admin container runs as root |
| 7 | C-SEC-07 | M-H | Email header injection plausibility in `messageUser` (CR/LF not stripped from subject) |
| 8 | C-CI-01 | M-H | CI doesn't run `lint`; `npm run verify` is enforced locally but not in the deploy workflow |
| 9 | C-SEC-08 | M | Raw `err.message` returned to users in actions and `lib/email.ts` |
| 10 | C-SEC-09 | M | Query layer has no embedded permission checks; relies on caller discipline |
| 11 | C-SEC-10 | M | No structured audit log for sensitive actions (invite/delete/role change/event delete) |
| 12 | C-SEC-11 | M | 7 moderate transitive vulns (esbuild via better-auth/drizzle-kit; postcss via next). Real exploitation paths don't apply, but track upstream |

## 3. Verified evidence for the previously-missed High-severity findings

### C-SEC-04 — Admin CDN caches with cookies (Copilot F-003)

`infra/terraform/pullzones.tf:58-59`:
```hcl
cache_enabled = true
strip_cookies = false
```
Comment at lines 49-53 acknowledges the risk and states the app *must* set `Cache-Control: no-store, private` on every authenticated response. Verified by grep: **no `Cache-Control` header is set anywhere in `apps/admin/src`**. This relies entirely on Better Auth's defaults. If Better Auth ever drops a `Cache-Control` header on a session-bearing response, the bunny.net pull-zone will cache it and serve it to the next caller. This is a cross-user data-leak primitive.

**Fix**: belt-and-suspenders. (a) Add `Cache-Control: private, no-store` via `headers()` in `apps/admin/next.config.ts` for `/(.*)` (paired with the security headers below). (b) Flip `strip_cookies = true` on the admin pull zone OR set `cache_enabled = false`. (c) Add a smoke/HTTP-harness test that asserts the header on a sample authenticated response.

### C-SEC-03 — Mutable Action ref (Copilot F-002, ChatGPT)

`.github/workflows/deploy.yml:142`: `uses: BunnyWay/actions/container-update-image@main`. All other actions are pinned to major-version tags (`@v3`, `@v4`, `@v6`) — those are still mutable but follow GitHub's documented convention. The `@main` is the real outlier and the highest-leverage fix.

**Fix**: pin BunnyWay action to a commit SHA (`uses: BunnyWay/actions/container-update-image@<sha>`). Optional follow-up: pin all third-party actions to SHAs and adopt Dependabot Action updates.

### C-SEC-05 — Temp-admin script (Copilot F-004)

`apps/admin/scripts/seed-temp-admin.ts:1-2` opens with: *"admin user WITHOUT enabling 2FA so the e2e sign-in via ff-rdp can complete"*. No `NODE_ENV !== 'production'` guard, no allow-flag, no DB-URL allowlist. Exposed as `seed:temp-admin` in `apps/admin/package.json:18`. Project memory already records that an iter-15b temp admin (`iter15b-verify-...@wardrobe-assistants.ch`) reached prod and needs deletion — confirming the operational risk is real, not theoretical.

**Fix**: hard-guard the script:
```typescript
if (env.nodeEnv === "production") {
  console.error("Refusing to run in production.");
  process.exit(1);
}
if (!process.env.ALLOW_TEMP_ADMIN) {
  console.error("Set ALLOW_TEMP_ADMIN=1 to confirm.");
  process.exit(1);
}
```
Also: any temp-admin email should match `*@wardrobe-assistants.ch` so prod cleanup queries are surgical, and rows should auto-expire (or the script should delete on second run).

### C-CI-01 — CI doesn't run `lint` (ChatGPT)

`.github/workflows/deploy.yml` `verify` job runs `typecheck` + `test` only. Local `npm run verify = lint && typecheck && test`. Biome formatting/lint rules — including the per-feature `noRestrictedImports` blocks that enforce the architecture — are **only enforced if a developer remembers to run `verify` locally**. CI doesn't catch architectural-isolation drift on PRs.

**Fix**: replace `npm run typecheck && npm run test` in CI with `npm run verify`. (Or at minimum add `npm run lint` as a separate step.)

### C-SEC-08 — Internal error leakage (Copilot F-005, ChatGPT)

Confirmed at:
- `apps/admin/src/lib/email.ts:54` — `throw new Error(\`Resend send failed: ${error.message}\`)`
- `apps/admin/src/features/users/server/actions.ts:86` — returns `err.message`
- `apps/admin/src/features/users/server/actions.ts:99, 161` — same pattern in `detail`

**Fix**: log the full `err` server-side; return generic strings (`"Failed to send invite"`, `"Failed to update profile"`). Pair with the audit-log work (C-SEC-10) so you have a correlation ID to point users at if you ever need to triage.

## 4. Reconciled findings — full table

Severity legend: **C**ritical / **H**igh / **M**edium / **L**ow / **I**nfo. Where reviewers disagreed, the consolidated severity reflects verified evidence and exploit-path realism.

### High-severity (act before any traffic increase)

| ID | Title | Files | One-line fix |
|---|---|---|---|
| C-SEC-01 | No security headers / CSP | `apps/admin/next.config.ts`, `apps/homepage/next.config.ts` | Add `headers()` with CSP, X-Frame-Options/`frame-ancestors`, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options |
| C-SEC-02 | No rate limiting on auth endpoints | Better Auth route handler | Sliding-window limiter (Upstash or in-memory): login 5/15min, reset 3/hour, invite 10/hour |
| C-SEC-03 | GHA `@main` mutable ref | `.github/workflows/deploy.yml:142` | Pin BunnyWay action to commit SHA |
| C-SEC-04 | CDN caches admin with cookies, no app-side `Cache-Control` | `infra/terraform/pullzones.tf:58-59`, `apps/admin/src/**` | Add `Cache-Control: private, no-store` in admin `next.config.ts` headers; consider `strip_cookies = true` on the pull zone as a CDN-side fallback |
| C-SEC-05 | `seed-temp-admin` no prod guard, no 2FA | `apps/admin/scripts/seed-temp-admin.ts`, `apps/admin/package.json:18` | Hard `NODE_ENV` guard + explicit allow-flag + auto-cleanup convention |
| C-SEC-06 | Container as root | `apps/admin/Dockerfile:35-59` | `RUN addgroup -S app && adduser -S app -G app` then `USER app` |

### Medium-severity

| ID | Title | Files | One-line fix |
|---|---|---|---|
| C-SEC-07 | Email header injection (CR/LF in `messageUser` subject) | `apps/admin/src/features/users/schema.ts`, same for events | Zod `.transform(s => s.replace(/[\r\n]/g, ' '))` on `subject`; smoke-test with `\r\nBcc:` payload |
| C-CI-01 | CI doesn't run `lint` | `.github/workflows/deploy.yml` | Replace `typecheck && test` with `npm run verify` |
| C-SEC-08 | Raw `err.message` to users | `apps/admin/src/lib/email.ts:54`, `users/server/actions.ts:86,99,161` | Generic user-facing strings; structured server log with correlation ID |
| C-SEC-09 | Query-level authz missing | `apps/admin/src/features/{users,events}/server/queries.ts` | Wrap sensitive queries in `withPermission`, or add `assertPermission()` at the top of each `listX/getX` |
| C-SEC-10 | No audit log | `apps/admin/src/features/**/server/actions.ts` | `audit_log` table + emit from inside `withPermission` for any mutating action |
| C-SEC-11 | Outdated transitive deps | `package-lock.json` | Re-run `npm audit --omit=dev`; track better-auth + Next 16.x for upstream patches; do **not** `audit fix --force` (proposes drizzle-kit downgrade and Next downgrade) |
| C-SEC-12 | No security scanning (Dependabot/CodeQL/Trivy) | `.github/` | Add Dependabot config; CodeQL workflow; Trivy scan in deploy workflow |
| C-SEC-13 | Missing `user_profile` silently denies | `apps/admin/src/lib/auth.ts:114-123` | Smoke test pinning the behavior; document in admin-architecture |
| C-NXT-01 | No `error.tsx` / `not-found.tsx` | `apps/admin/src/app/(dashboard)/` | Add `(dashboard)/error.tsx` (with `reset`), `(dashboard)/not-found.tsx`, optional root `error.tsx` |
| C-INF-01 | No down-migration runbook | `kb/runbooks/` | Document "container won't start because migration X failed" recovery |
| C-TST-01 | `messageUser` happy path not in smoke suite | `apps/admin/src/features/users/server/users.smoke.test.ts` | Add smoke test (catches C-SEC-07 too) |

### Low-severity

| ID | Title | Files | Fix |
|---|---|---|---|
| C-NXT-02 | Homepage external font stylesheet vs `next/font` | `apps/homepage/src/app/layout.tsx:90-98` | Render-blocking risk on the static homepage. Consider `next/font` (works with `output: "export"` for `local` fonts; `bunny.net` would need self-hosting) |
| C-AUTH-01 | `requireEmailVerification: false` undocumented | `apps/admin/src/lib/auth.ts:31` | Document the invite-flow rationale in `kb/admin-architecture/auth-and-permissions.md`; add invite-token expiry + single-use test |
| C-MONO-01 | Root `build` script only builds homepage | `package.json:13` | Either `"build": "npm run build --workspaces"` or rename to `"build:homepage"` for clarity |
| C-AUTHZ-01 | `useHasPermission` reads `session.user.role` (cast) | `apps/admin/src/hooks/use-has-permission.ts` | Hook output is a UI hint only; `withPermission` is authoritative server-side. Add a comment to that effect, or move client-side gating to a dedicated server endpoint |
| C-A11Y-01 | Mobile-nav `aria-expanded` not synced | (Copilot didn't cite path; verify before fixing) | Trace the checkbox/label pattern; sync `aria-expanded` to checkbox state |
| C-DEP-01 | Patch bumps available | `package.json` workspaces | One small dep-bump PR: `react@19.2.6`, `tailwindcss@4.3.0`, `resend@6.12.3` |
| C-TS-01 | `skipLibCheck: true` hides upstream type bugs | `tsconfig.base.json:9` | Optional weekly CI job with `skipLibCheck: false` |
| C-TS-02 | `EventForm` `undefined as unknown as Date` | `apps/admin/src/features/events/components/EventForm.tsx:73` | Type form value as `Date \| undefined` and adapt the schema |
| C-MONO-02 | `zod` not declared in `packages/db` | `packages/db/package.json` | Add `zod@^4.4.3` to deps |
| C-SEC-14 | No Better Auth `trustedOrigins` | `apps/admin/src/lib/auth.ts:13-28` | Add `trustedOrigins: [BETTER_AUTH_URL]` (verify Better Auth API shape first) |
| C-SEC-15 | Min password length 8 | `apps/admin/src/lib/login-schema.ts:5-6` | Bump to `.min(12)` + UI strength hint |
| C-OPS-01 | No CI Lighthouse budget gate | `scripts/lighthouse.mjs`, CI | Wire into `verify`; fail on LCP/CLS regression |
| C-SEO-01 | `sitemap.ts` uses `new Date()` for `lastModified` | `apps/homepage/src/app/sitemap.ts` | Use content-driven timestamps |

## 5. OWASP Top 10 (2021) — consolidated coverage

| Category | Status | Top issues |
|---|---|---|
| A01 Broken access control | ❌ | C-SEC-04 (CDN cross-user leak), C-SEC-09 (query-level), C-SEC-13 (missing-profile UX), C-SEC-14 |
| A02 Cryptographic failures | ✅ mostly | Strong env validation; HttpOnly+Secure cookies; PII at rest plaintext (accepted) |
| A03 Injection | ⚠️ | Drizzle/Zod cover SQL; **C-SEC-07** (email header) is open |
| A04 Insecure design | ⚠️ | C-SEC-02 (rate limit), C-SEC-10 (audit log) |
| A05 Security misconfiguration | ❌ | **C-SEC-01 (headers/CSP)**, C-SEC-06 (root container) |
| A06 Vulnerable & outdated components | ⚠️ | C-SEC-11 (7 moderate, 0 high/critical; real risk low for this deployment) |
| A07 Identification & auth failures | ⚠️ | C-SEC-02, **C-SEC-05 (temp-admin)**, C-SEC-15, C-AUTH-01 |
| A08 Software & data integrity | ❌ | **C-SEC-03 (`@main`)** |
| A09 Logging & monitoring | ❌ | C-SEC-08 (error leak), C-SEC-10 (no audit log), C-SEC-12 (no scanning) |
| A10 SSRF | ✅ | No user-controlled fetch / image-domain allowlist |

## 6. Disputed / overstated findings

Things flagged by one reviewer that are weaker on closer inspection:

- **Copilot F-007 / ChatGPT "Vulnerable components"** rated as a single bucket. Reality (verified with `npm audit --omit=dev` 2026-05-09): 7 moderate, 0 high, 0 critical. The esbuild advisory is dev-server-only and doesn't apply to the deployed container. The postcss advisory requires user-controlled CSS through stringify — this app processes only its own author Tailwind. **Real severity: Medium-Low operational hygiene, not "production-path vulnerability".** Don't run `npm audit fix --force` — it proposes drizzle-kit and Next downgrades.
- **Pinning `actions/checkout@v4` etc. to commit SHA** (implied in F-002 / ChatGPT). The `@main` is the actual high-severity issue; pinning every action to SHA is org-policy preference and adds maintenance friction. Recommend: SHA-pin the third-party / less-trusted actions (BunnyWay), keep major-tag for first-party (`actions/*`, `docker/*`).
- **Claude C-01 vs Copilot F-010** on `useHasPermission`. The hook is a UI hint; server-side `withPermission` is authoritative. Severity Low (Copilot's call is fine, Claude's "Info / known wart" is also fine). Worth a code comment but not a refactor.
- **Claude E-06 ("positive") vs Copilot ("render-blocking risk")** on the homepage external font stylesheet. Reconciled: Bunny Fonts with `display=swap` is privacy-respecting and prevents FOIT, but `<link>` to a third-party stylesheet is render-blocking by spec. `next/font` (with self-hosted fonts) would be objectively better for LCP. Listed as C-NXT-02 Low.

## 7. Final prioritized action plan

Ordered by **risk reduction × inverse effort**. Group 1 should land before any meaningful traffic; Group 2 within the next 1–2 iterations; Group 3 is hygiene.

### Group 1 — High risk, low-to-medium effort (target: next iteration)

1. **Pin `BunnyWay/actions/container-update-image` to SHA** (C-SEC-03). 1-line diff.
2. **Add `Cache-Control: private, no-store` to admin `next.config.ts`** (C-SEC-04) + flip `strip_cookies = true` on the admin pull zone OR set `cache_enabled = false` as belt-and-suspenders.
3. **Hard-guard `seed-temp-admin.ts`** (C-SEC-05): `NODE_ENV` check + `ALLOW_TEMP_ADMIN=1` gate + email pattern enforcement.
4. **Add security headers** (C-SEC-01) in `apps/admin/next.config.ts` (and homepage). Start permissive on CSP, tighten in iter-N+1.
5. **Drop container privileges** (C-SEC-06): `USER app` in `apps/admin/Dockerfile`.
6. **Run `npm run verify` in CI** (C-CI-01): replace `typecheck + test` with `verify`.
7. **Strip CR/LF in messageUser/messageEventAssignees subject** (C-SEC-07) + smoke test.

### Group 2 — Medium risk, medium effort (next 1–2 iterations)

8. **Rate limit Better Auth endpoints** (C-SEC-02). In-memory sliding window OK for single container; revisit if scaled.
9. **Sanitize action error messages** (C-SEC-08): generic user strings + structured server log with correlation ID.
10. **Audit log table + emit from `withPermission`** (C-SEC-10).
11. **Query-layer authz** (C-SEC-09): add `assertPermission()` to each sensitive `listX/getX`.
12. **`error.tsx` + `not-found.tsx`** under `(dashboard)` and root (C-NXT-01).
13. **Smoke test: profile-less user denies all actions** (C-SEC-13). Pins the 2026-05-09 incident as regression.
14. **Down-migration runbook** in `kb/runbooks/` (C-INF-01).
15. **Add Dependabot + CodeQL + Trivy + secret scanning** (C-SEC-12).

### Group 3 — Hygiene (when time allows)

16. Dep-bump PR: `react@19.2.6`, `tailwindcss@4.3.0`, `resend@6.12.3` (C-DEP-01).
17. `min(12)` for passwords + UI strength hint (C-SEC-15).
18. Better Auth `trustedOrigins` (C-SEC-14).
19. Document `requireEmailVerification: false` rationale (C-AUTH-01) in `kb/admin-architecture/auth-and-permissions.md`.
20. Track better-auth + Next 16.x releases for the postcss/esbuild transitive bumps (C-SEC-11).
21. CI Lighthouse budget gate (C-OPS-01).
22. `next/font` for the homepage if LCP regresses (C-NXT-02).
23. Fix `EventForm` date typing (C-TS-02).
24. Add `zod` to `packages/db` deps (C-MONO-02).
25. Mobile-nav `aria-expanded` sync (C-A11Y-01).
26. `sitemap.ts` content-driven `lastModified` (C-SEO-01).
27. Rename/scope root `build` script (C-MONO-01).

## 8. What would un-mistake the next audit

- **Run `npm audit` and `npm outdated` first.** Claude did this on a follow-up; ChatGPT and Copilot both reported "production-path vulnerabilities" without distinguishing dev-server-only advisories from runtime risk. A 30-second command would have prevented that.
- **Read the Terraform.** Copilot was the only one to read `infra/terraform/pullzones.tf` and catch the cache-with-cookies issue (#1 in Group 1). Future audits should explicitly include `infra/terraform/**`.
- **Scan `scripts/`.** Copilot caught the temp-admin script; the other two missed it. Future audits should explicitly include `apps/*/scripts/`.
- **Read CI workflows in detail.** ChatGPT caught the lint gap; the others missed it. Diff the workflow against the root `package.json` `verify` script.
- **Send the auditor the project memory.** Claude had access to `kb/admin-architecture/decision-log.md` and project memory recording the iter-15b temp-admin incident, which made S-04 actionable. ChatGPT and Copilot didn't have that context and inferred from code alone.
