---
title: Findings index — 2026-05-09 audits → iterations map
type: index
status: current
created: 2026-05-09
tags: [audit, findings, index]
related: [audit-2026-05-09-consolidated.md, audit-2026-05-09-frontend-consolidated.md]
---

# Findings index

Single source of truth for "where does each audit finding land?" Every consolidated finding from the 2026-05-09 audits is mapped to its target iteration. Update this file as findings close.

Status legend: 🟡 planned · 🟢 closed · ⚪ deferred · ❌ accepted-as-risk

## Security findings (consolidated security audit)

Source: [audit-2026-05-09-consolidated.md](audit-2026-05-09-consolidated.md)

### Group 1 — High severity (iter-16b)

| ID | Title | Iter | Status |
|---|---|---|---|
| C-SEC-01 | No security headers / CSP | 16b | 🟡 |
| C-SEC-02 | No rate limiting on Better Auth endpoints | 16f | 🟡 |
| C-SEC-03 | `BunnyWay/actions/container-update-image@main` mutable ref | 16b | 🟡 |
| C-SEC-04 | Admin pull-zone caches with cookies, no app-side `Cache-Control` | 16b | 🟡 |
| C-SEC-05 | `seed-temp-admin` no production guard, no 2FA | 16b | 🟡 |
| C-SEC-06 | Admin container runs as root | 16b | 🟡 |
| C-SEC-07 | Email header injection (CR/LF in messageUser subject) | 16b | 🟡 |
| C-CI-01 | CI doesn't run `lint` (`verify` skipped) | 16b | 🟡 |

### Group 2 — Medium severity (iter-16f, except UI-flavoured ones)

| ID | Title | Iter | Status |
|---|---|---|---|
| C-SEC-08 | Raw `err.message` exposed in user-facing actions / email | 16f | 🟡 |
| C-SEC-09 | Query-layer authorization missing (route-only auth) | 16f | 🟡 |
| C-SEC-10 | No audit log for sensitive actions | 16f | 🟡 |
| C-SEC-11 | Outdated transitive deps (esbuild, postcss) | — | ⚪ Track upstream (better-auth, Next 16.x) |
| C-SEC-12 | No automated security scanning (Dependabot/CodeQL/Trivy) | 16f | 🟡 |
| C-SEC-13 | Missing `user_profile` silently denies all permissions | 16f | 🟡 |
| C-NXT-01 | No `error.tsx` / `not-found.tsx` boundaries | 16e | 🟢 |
| C-INF-01 | No down-migration / rollback runbook | 16f | 🟡 |
| C-TST-01 | `messageUser`/`messageEventAssignees` happy-paths not in smoke | 16b | 🟡 (rides with C-SEC-07 fix) |

### Group 3 — Low / hygiene

| ID | Title | Iter | Status |
|---|---|---|---|
| C-NXT-02 | Homepage external font stylesheet vs `next/font` | — | ⚪ Re-evaluate if LCP regresses |
| C-AUTH-01 | `requireEmailVerification: false` undocumented | 16f | 🟡 (doc only) |
| C-MONO-01 | Root `build` only builds homepage | — | ⚪ Cosmetic; document or rename |
| C-AUTHZ-01 | `useHasPermission` reads `session.user.role` cast | — | ⚪ Documented wart; leave |
| C-A11Y-01 | Mobile-nav `aria-expanded` not synced (homepage) | — | ⚪ Working today |
| C-DEP-01 | Easy patch bumps (react 19.2.6, tailwind 4.3.0, resend 6.12.3) | 16f | 🟡 (rides with security scanning) |
| C-TS-01 | `skipLibCheck: true` hides upstream type bugs | — | ⚪ Optional weekly job |
| C-TS-02 | `EventForm` `undefined as unknown as Date` cast | 16e | 🟢 (= F-FE-12) |
| C-MONO-02 | `zod` not declared in `packages/db` | 16f | 🟡 (rides with security scanning) |
| C-SEC-14 | No Better Auth `trustedOrigins` | 16f | 🟡 |
| C-SEC-15 | Min password length 8 → 12 | 16f | 🟡 |
| C-OPS-01 | No CI Lighthouse budget gate | — | ⚪ Defer |
| C-SEO-01 | Homepage `sitemap.ts` runtime `new Date()` | — | ⚪ Defer |
| S-28 | PII at rest plaintext (mobile, name) | — | ❌ Accepted: bunny.net DB perimeter |

## Frontend findings (consolidated frontend audit)

Source: [audit-2026-05-09-frontend-consolidated.md](audit-2026-05-09-frontend-consolidated.md)

| ID | Title | Iter | Status |
|---|---|---|---|
| F-FE-01 | Login page bypasses shadcn `<Form>`/`<Input>` | 16g | 🟢 |
| F-FE-02 | No `role="alert"` / `aria-live` on form-level server errors | 16e | 🟢 |
| F-FE-03 | TanStack Table loaded for read-only tables | 16d | 🟢 |
| F-FE-04 | No `loading.tsx` / `error.tsx` / `not-found.tsx` | 16e | 🟢 |
| F-FE-05 | Admin sidebar `hidden md:block`; no mobile nav | 16d | 🟢 |
| F-FE-06 | No `aria-current="page"` on active sidebar links | 16d | 🟢 |
| F-FE-07 | Homepage `<Button>` always renders `<a>`; `href` not required | 16e | 🟢 (renamed → `LinkButton`) |
| F-FE-08 | `EVENT_CREATE` gates event-detail viewing | 16d | 🟢 (`EVENT_VIEW` added) |
| F-FE-09 | Zero React component tests | 16e + 16g | 🟢 (16e: small ✅; 16g: load-bearing trio ✅) |
| F-FE-10 | Manual `useMemo` contradicts React Compiler | 16d | 🟢 |
| F-FE-11 | Login two-step doesn't move focus to TOTP | 16g | 🟢 |
| F-FE-12 | EventForm `undefined as unknown as Date` cast | 16e | 🟢 |
| F-FE-13 | Homepage Footer + ServiceCard hardcoded hex | 16d | 🟢 |
| F-FE-14 | Homepage mobile-nav checkbox-hack | — | ⚪ Working; defer |
| F-FE-15 | Submit-pattern duplicated 4× → `useFormAction()` | 16e | 🟢 |
| F-FE-16 | EventStatusBadge / users StatusBadge drift | 16e | 🟢 |
| F-FE-17 | SignOutButton manual `useState`; failures silent | 16d | 🟢 |
| F-FE-18 | EventsTable redundant "Open" column | 16d | 🟢 |
| F-FE-19 | Dead `<Check opacity-0>` in AssigneesPicker | 16d | 🟢 |
| F-FE-20 | Tables lack `aria-label` | 16d | 🟢 |
| F-FE-21 | Duplicate `auth.api.getSession()` in 5 files | 16d | 🟢 (`getCachedSession` helper) |
| F-FE-22 | `--radius-m` defined but unused | 16d | 🟢 (adopted per DS doc) |
| F-FE-23 | Unicode `←` arrow vs `<ArrowLeft />` | 16d | 🟢 |
| F-FE-24 | Tokens duplicated across admin + homepage | — | ⚪ Defer until 3rd surface appears |
| F-FE-25 | MessageDialog form-reset dep array (unstable `form`) | 16d | 🟢 |
| F-FE-26 | Login page muxes credentials+TOTP; should split | 16g | 🟢 |
| F-FE-27 | `--muted-foreground` contrast borderline AA | — | ⚪ Run contrast checker first; iter-16c notes it |
| F-FE-28 | Destructive dialogs disable Esc-to-close during pending | — | ⚪ Documented intentional |
| F-FE-29 | EyebrowBadge string-template ternary vs `cn()` | 16d | 🟢 |

## Iteration-by-iteration summary

| Iter | Order | Theme | Findings closed |
|---|---|---|---|
| [16b](../iterations/iteration-16b-edge-hardening.md) | 17.3 | Security & edge hardening | C-SEC-01/03/04/05/06/07, C-CI-01, C-TST-01 |
| [16c](../iterations/iteration-16c-design-system-foundation.md) | 17.4 | Design system foundation (doc + responsive baseline + vendor primitives) | (none directly — sets up everything else) |
| [16d](../iterations/iteration-16d-ui-cleanup-nav-data.md) | 17.5 | UI cleanup pass 1 (sidebar, tables, quick wins) | F-FE-03/05/06/08/10/13/17/18/19/20/21/22/23/25/29 |
| [16e](../iterations/iteration-16e-ui-cleanup-forms-boundaries.md) | 17.6 | UI cleanup pass 2 (forms, boundaries, first tests) | F-FE-02/04/07/12/15/16, C-NXT-01, C-TS-02 |
| [16f](../iterations/iteration-16f-defense-in-depth.md) | 17.7 | Defense-in-depth security | C-SEC-02/08/09/10/12/13/14/15, C-INF-01, C-AUTH-01, C-MONO-02, C-DEP-01 |
| [16g](../iterations/iteration-16g-login-redesign.md) | 17.8 | Login redesign + load-bearing tests | F-FE-01/09/11/26 |
| [17](../iterations/iteration-17-services-feature.md) | 18 | Services feature (existing plan; inherits everything above) | — |

Findings deliberately deferred or accepted: C-SEC-11 (track upstream), C-NXT-02, C-MONO-01, C-AUTHZ-01, C-A11Y-01, C-TS-01, C-OPS-01, C-SEO-01, S-28, F-FE-14, F-FE-24, F-FE-27, F-FE-28.

## How to maintain this file

- When an iter PR merges, flip 🟡 → 🟢 for each finding it closes.
- If a finding moves to a different iteration, update the row.
- If a finding is reopened or a new one surfaces, add it with the next available C-/F-FE- ID and an iteration target.
- This file is the canonical "what's the status of finding X" answer; iter plans cite finding IDs back here.
