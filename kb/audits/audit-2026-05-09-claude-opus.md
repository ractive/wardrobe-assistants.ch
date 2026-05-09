---
title: Codebase audit — Claude Opus 4.7 (1M ctx) — 2026-05-09
type: audit
status: draft
reviewer: claude-opus-4-7
created: 2026-05-09
tags: [audit, security, owasp, nextjs, review]
related: [overview.md, decision-log.md, auth-and-permissions.md]
---

# Codebase audit — Claude Opus 4.7 — 2026-05-09

Read-only audit of the Next.js 16 monorepo. Triggered after iter-16 (events feature) merge. Scope per the prompt: architecture, Next.js 16 best practices, React 19/TypeScript, shadcn/Tailwind, security (OWASP 2021/2025), testing, performance/SEO, infrastructure, dependencies.

This file is **draft** pending consolidation with parallel audits from GitHub Copilot and ChatGPT.

## 1. Executive summary

The application logic is in good shape: Better Auth + permissions catalog with a `withPermission` wrapper consistently applied to every server action, Zod validation at every trust boundary, Drizzle for parameterized DB access, Biome-enforced feature isolation, smoke harness running real auth + DB. Env validation has prod tripwires (`BETTER_AUTH_SECRET` 64-hex, placeholder rejection). No `dangerouslySetInnerHTML`, no `child_process`, no user-supplied fetch targets, no file upload surface.

The gaps are at the **HTTP edge and operational hardening**, not in app logic:

1. No security headers on `apps/admin` (no CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy).
2. No rate limiting on Better Auth endpoints (login, signup, password-reset).
3. Container runs as root.
4. Outdated transitive deps (`esbuild` via drizzle-kit/better-auth, `postcss` via next).
5. No audit log for sensitive admin actions (invite, delete, role change).
6. Missing `error.tsx` / `not-found.tsx` boundaries.
7. Email subject/body in `messageUser` not stripped of CR/LF (header-injection plausibility).

None are actively exploited; #1, #2, #3, #4 should land before any meaningful traffic increase.

## 2. Top 10 highest-risk findings

| Rank | ID | Severity | Title |
|---|---|---|---|
| 1 | S-16 | High | No security headers in admin (`next.config.ts` has no `headers()`) |
| 2 | S-24 | High | No rate limiting on Better Auth endpoints |
| 3 | I-03 | High | Admin container runs as root (no `USER` directive in `apps/admin/Dockerfile`) |
| 4 | D-03 | Medium | Outdated transitive deps: esbuild, postcss (7 moderate; 0 high/critical) |
| 5 | S-25 | Medium-High | `messageUser` accepts subject/body without CR/LF stripping → email header injection |
| 6 | S-19 | Medium | No audit log for sensitive actions (invite/delete/role change/event delete) |
| 7 | B-04 | Medium | No `error.tsx` / `not-found.tsx` boundaries in admin app |
| 8 | S-04 | Medium | Missing `user_profile` row silently denies all permissions; no integration test guarding this |
| 9 | I-05 | Medium | No documented down-migration / rollback procedure (auto-migrate on boot) |
| 10 | T-06 | Medium | `messageUser` and `messageEventAssignees` happy-paths not in smoke suite (would catch #5) |

## 3. Findings table

> Severity: **C**ritical / **H**igh / **M**edium / **L**ow / **I**nfo. Confidence: H/M/L based on whether finding was directly verified vs inferred.

### Architecture & monorepo

| ID | Sev | File(s) | Evidence | Why it matters | Fix | Conf |
|---|---|---|---|---|---|---|
| A-01 | M | `packages/db/package.json` | `zod` used by db schemas indirectly, not declared; declared in root + admin | Implicit hoisting works today; future workspace refactor could break silently | Add `zod@^4.4.3` to `packages/db` deps | H |
| A-05 | I | `biome.json:43-107` | Three `noRestrictedImports` blocks enforce vertical-slice isolation | Architectural rule enforced at lint, not vibes. Worth preserving when adding `services/` slice in iter-17 | Keep adding feature override blocks per slice | H |
| A-06 | I | grep across workspaces | All cross-package imports go through `@wardrobe-assistants/db` exports; no `../../../` traversal | Clean monorepo boundaries | None | H |
| A-07 | L | `apps/admin/tsconfig.json:16-23`, `apps/homepage/tsconfig.json:17-24` | Homepage includes `**/*.mts`; admin doesn't | Cosmetic drift | Either drop from homepage or align both | M |

### Next.js 16

| ID | Sev | File(s) | Evidence | Why it matters | Fix | Conf |
|---|---|---|---|---|---|---|
| B-04 | M | `apps/admin/src/app/` | No `error.tsx`, no `not-found.tsx` at any segment. Inline `notFound()` in `(dashboard)/events/[id]/page.tsx:37` falls back to framework default | Errors in events flow render Next default pages | Add `(dashboard)/error.tsx` (client, with `reset`), `(dashboard)/not-found.tsx`, optional root `error.tsx` | H |
| B-03 | I | `apps/admin/src/app/(dashboard)/layout.tsx:13-17`, `apps/admin/middleware.ts:13-23` | Middleware = cookie-presence (edge); layout = `auth.api.getSession()` against DB | Correct split; "source of truth = layout" comment is accurate | None | H |
| B-06 | I | `apps/admin/src/features/{events,users}/server/actions.ts` | Every exported action wraps `withPermission(...)`. Every action calls `safeParse()` before DB use | Single most important invariant in admin. Don't break it | None | H |
| B-07 | I | `apps/admin/src/features/events/server/actions.ts:51,82,102,151,176,207` | `revalidatePath("/events")` and `revalidatePath("/events/${id}")` after mutations | On-demand invalidation appropriate for admin | None | H |
| B-08 | I | `apps/admin/src/app/(dashboard)/events/[id]/page.tsx:17-22` | `params: Promise<{ id: string }>; const { id } = await params;` | Next 16 async-params pattern correctly applied | None | H |
| B-10 | I | `apps/admin/next.config.ts` | `output: "standalone"`, `outputFileTracingRoot`, `reactCompiler: true` | Standalone bundle includes `@wardrobe-assistants/db` from workspace root, suitable for bunny.net container | None | H |
| B-11 | I | `apps/homepage/next.config.ts` | `output: "export"`, `images: { unoptimized: true }`, `trailingSlash: true` | Correct shape for static-on-CDN homepage | None | H |

### React 19 / TypeScript

| ID | Sev | File(s) | Evidence | Why it matters | Fix | Conf |
|---|---|---|---|---|---|---|
| C-01 | I | `apps/admin/src/hooks/use-has-permission.ts:1-20` | Casts `session.user.role`; Better Auth doesn't include role in default session schema | Mirrors server `roleHasPermission` — isomorphic. Cast is documented wart (iter-15c) | Drop cast if `additionalFields` ever lands cleanly | H |
| C-02 | M | `apps/admin/src/features/events/components/EventForm.tsx:73` | `date: defaults?.date ?? (undefined as unknown as Date)` | RHF type expects Date; cast hides "no date selected" path | Type form value as `Date \| undefined` and adapt schema, or set required default at init | M |
| C-04 | I | `apps/admin/src/` | No `: any` or `as any` outside test mocks | Strong type discipline | None | H |
| C-05 | I | `apps/admin/src/features/{events,users}/schema.ts`, `lib/login-schema.ts` | Zod schemas with bounded strings (`.max(254)` email, `.max(200)` event name, `.max(10000)` notes) | Bounded inputs prevent cheap DoS via huge payloads | None | H |

### shadcn / Tailwind

| ID | Sev | File(s) | Evidence | Why it matters | Fix | Conf |
|---|---|---|---|---|---|---|
| D-01 | I | `apps/admin/components.json` | Aliases match real import paths | `shadcn add` lands in right place | None | H |
| D-02 | I | `apps/admin/src/components/ui/` | 16 primitives present, excluded from Biome lint | Clean separation | None | H |
| D-05 | L | UI components | No `cva` usage; inline Tailwind via `cn()` | Fine for current scope; will get noisy as variants grow | Reach for `cva` when component has ≥3 variant axes | M |
| D-08 | I | UI primitives | All interactive primitives wrap Radix UI (`@radix-ui/react-dialog`, `popover`, `dropdown-menu`, `select`) | Free ARIA + focus + keyboard nav | None | H |

### Security (OWASP-aligned)

| ID | Sev | OWASP | File(s) | Evidence | Why it matters | Fix | Conf |
|---|---|---|---|---|---|---|---|
| **S-16** | **H** | A05 | `apps/admin/next.config.ts` | No `headers()` export. No CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy | Clickjacking, XSS amplification, MIME sniffing, referrer leak — all unmitigated at HTTP edge | Add `headers()`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`, `HSTS: max-age=31536000; includeSubDomains`. CSP highest-leverage — start `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'` and tighten | H |
| **S-24** | **H** | A07 | `apps/admin/src/app/api/auth/[...all]/route.ts` | No rate-limit middleware around Better Auth routes | Brute-force on login/password-reset/invite is unthrottled | Sliding-window limiter (Upstash Ratelimit, or in-memory). Login 5/15min/IP+email; reset 3/hour/email; invite 10/hour/admin | H |
| **S-25** | M-H | A03 | `apps/admin/src/features/users/server/actions.ts:155-159`, `users/schema.ts` | `messageUser` passes user-supplied subject/body to `sendEmail()` without CR/LF stripping | `USER_MESSAGE` perm holder can inject `\r\nBcc:` into subject. Currently only ADMIN has perm, blast radius limited; same pattern in `messageEventAssignees` | Zod `.transform(s => s.replace(/[\r\n]/g, ' '))` for subject. Verify Resend's body handling | H |
| S-04 | M | A01 | `apps/admin/src/lib/auth.ts:114-123`, `lib/permissions.ts:58-74` | Missing `user_profile` row → `roleForUserId` returns null → all checks deny silently. **Confirmed live 2026-05-09**: james@ractive.ch had no profile | Behavior correct (deny by default), UX is "menu items invisible, no error". Easy to mis-diagnose | Add smoke test: "user with no profile cannot perform any gated action" | H |
| S-18 | L | A01 | `apps/admin/src/lib/auth.ts:13-28` | Better Auth config has no `trustedOrigins`. SameSite=lax + Next server-action token are the only origin gates | Server actions are POST-protected by Next; SameSite=lax blocks third-party POST. `trustedOrigins` is belt-and-suspenders | Add explicit `trustedOrigins: [BETTER_AUTH_URL]` | M |
| **S-19** | M | A09 | `apps/admin/src/features/**/server/actions.ts` | Only `console.error` on failures; no structured audit log | "Who deleted user X" → unanswerable. Compliance/IR have no trail | Add `audit_log(id, actor_user_id, action, target_id, target_type, metadata_json, created_at)`; emit from inside `withPermission` for any mutating action | H |
| S-08 | L | A07 | `apps/admin/src/lib/login-schema.ts:5-6` | `password: z.string().min(8)` | NIST/OWASP modern guidance favors longer passphrases over complexity rules; 8 is floor; ADMIN justifies higher | Bump to `.min(12)`, add UI strength hint, no character-class rules | M |
| S-28 | L | A02 | `packages/db/src/schema/users.ts:8-22` | `firstName`, `lastName`, `mobileNumber` plaintext in libSQL | DB inside bunny.net perimeter; exfil = direct PII read | Acceptable for current threat model; document. If sensitivity rises, app-level encryption for `mobileNumber` | M |
| S-01 | I | A07 | `apps/admin/src/lib/auth.ts`, `lib/env.ts:59-75` | HttpOnly + Secure + SameSite=lax cookies; TOTP plugin enabled; `BETTER_AUTH_SECRET` 64-hex enforced in prod (`HEX_64.test(...)` + placeholder rejection) | Strong baseline | None | H |
| S-10 | I | A03 | `apps/admin/src/features/{users,events}/server/queries.ts` | All Drizzle queries use builders or parameterized `sql\`…\${param}\`` — no string interpolation | No SQL injection vector | None | H |
| S-12 | I | A03 | grep across `apps/admin/src` | Zero `dangerouslySetInnerHTML` / `innerHTML` | XSS via React rendering closed | None | H |
| S-13 | I | A02 | `apps/admin/src/lib/env.ts` | No `NEXT_PUBLIC_*` vars. No hardcoded keys/tokens in source | Secrets live in env only | None | H |
| S-21 | I | A10 | grep | No user-controlled `fetch(...)`; no `next/image` remote domains (homepage uses `unoptimized: true`) | No SSRF surface | None | H |
| S-22 | I | — | `apps/admin/src/app/(dashboard)/page.tsx:9`, `set-password/page.tsx:68` | All redirects use hardcoded paths | No open-redirect surface | None | H |
| S-23 | I | A04 | grep | No `<input type="file">`, no multipart handlers | No upload attack surface | None | H |

### Testing

| ID | Sev | File(s) | Evidence | Fix | Conf |
|---|---|---|---|---|---|
| T-01 | I | `vitest.config.ts`, 13 admin test files | Three vitest projects (homepage/admin/db); happy-dom for UI, node for db; smoke project pulls real DB | Keep | H |
| T-02 | I | `apps/admin/src/test/http-harness.ts`, `users.smoke.test.ts` | Real libSQL tmp DB, real migrations, real Better Auth path. Verifies inviteUser, deleteUser, SQUAD_MEMBER permission denial | Keep mandatory per slice (iter-15c convention) | H |
| T-03 | I | `apps/admin/src/lib/permissions.ts:35-42` | Module-load loop asserts every PERMISSIONS entry is granted to ≥1 role | Keep | H |
| T-06 | M | `users.smoke.test.ts` | `messageUser` and `messageEventAssignees` happy paths not in smoke suite | Smoke test that calls `messageUser` with `\r\n` in subject; assert stripped/rejected (catches S-25) | H |
| T-07 | M | (gap) | No regression test for "user without `user_profile`" | Add smoke test per S-04 | H |

### Performance / SEO

| ID | Sev | File(s) | Evidence | Notes | Conf |
|---|---|---|---|---|---|
| E-01 | I | `scripts/lighthouse.mjs` | Defaults to prod URL; `LH_TARGET=local` switches to localhost:4173. Reports → `kb/perf-reports/` | Worth adding to CI as regression gate | H |
| E-02 | I | `apps/homepage/src/app/layout.tsx:1-112` | OpenGraph, Twitter card, JSON-LD `ProfessionalService`, canonical link | Good SEO baseline | H |
| E-03 | I | `apps/admin/src/app/layout.tsx:1-8` | `robots: { index: false, follow: false }` | Admin opted out of indexing | H |
| E-06 | I | `apps/homepage/src/app/layout.tsx:90-98` | Bunny Fonts + `display=swap` | Privacy-respecting + no FOIT | H |
| E-07 | I | `apps/homepage/src/app/layout.tsx:84-89` | `<link rel="preload" as="image" href="/background.webp" fetchPriority="high">` | LCP optimization | H |
| E-08 | I | both `next.config.ts` | `reactCompiler: true` | Auto-memoization on | H |

### Infrastructure / deployment

| ID | Sev | File(s) | Evidence | Why it matters | Fix | Conf |
|---|---|---|---|---|---|---|
| **I-03** | **H** | `apps/admin/Dockerfile:35-59` | No `USER` directive; runner stage runs as root | Privilege escalation surface; node doesn't need root | `RUN addgroup -S app && adduser -S app -G app` and `USER app` before `CMD` | H |
| I-04 | I | `apps/admin/src/instrumentation.ts`, `lib/migrate.ts` | Auto-runs Drizzle migrations on Next.js `register()`. `MIGRATE_ON_BOOT` toggles | Schema always up-to-date | Keep | H |
| **I-05** | M | (no doc) | No documented down-migration / rollback procedure | Failed migration → CrashLoop → manual SQL surgery via `hoppy db` is only path | Runbook in `kb/runbooks/`: "container won't start because migration X failed". Include `MIGRATE_ON_BOOT=false` escape + how to inspect via `hoppy db` | H |
| I-06/I-07 | I | `.github/workflows/deploy.yml` | Verify (typecheck/test/build) → static export to bunny Storage → docker build to ghcr → BunnyWay container-update-image bumps tag to `${{ github.sha }}`. Secrets via `${{ secrets.* }}` | Reproducible, secret-clean, easy rollback (re-tag previous SHA) | Keep | H |
| I-08 | I | `npm run verify:tf` | `tofu fmt -check && tofu validate` | Catches TF syntax pre-deploy | Add `tflint` or `tfsec`/`checkov` if scope grows | M |

### Dependencies

| ID | Sev | Evidence | Fix | Conf |
|---|---|---|---|---|
| **D-03** | **M** | Re-run `npm audit --omit=dev` 2026-05-09: **7 moderate, 0 high, 0 critical**. Two chains: (a) esbuild ≤0.24.2 (GHSA-67mh-4wv8-2f99) via `better-auth → drizzle-kit → @esbuild-kit/esm-loader`; (b) postcss <8.5.10 (GHSA-qx2v-qp2m-jg93) via `next → postcss` | (a) `npm audit fix --force` proposes drizzle-kit@0.18.1 (huge regression from current ^0.31.10) — **don't run**. Real fix: track better-auth releases for a version using a drizzle-kit not on the @esbuild-kit chain. Real risk low: dev-server vuln, drizzle-kit only runs at build/migrate, container has no esbuild dev server. (b) Proposed fix is `next@9.3.3` — absurd downgrade. Real fix: wait for Next 16.x to bump bundled postcss. Real risk negligible: vuln requires user-controlled CSS through stringify; this app processes only its own author Tailwind | H |
| D-01 | I | Next 16.2.6, React 19.2.5, Better Auth ^1.6.9, Drizzle ^0.45.2, Zod ^4.4.3, Vitest ^4.1.5 | Modern, no EOL versions | H |
| D-02 | I | No `preinstall`/`postinstall`/`prepare` lifecycle hooks | Reduced supply-chain hook risk | H |
| D-04 | I | `npm outdated` 2026-05-09: react/react-dom 19.2.5→19.2.6 (patch, safe); tailwind 4.2.4→4.3.0 (minor); resend 6.12.2→6.12.3 (patch); @hookform/resolvers 3.10→5.2 (major, eval); typescript 5.9.3→6.0.3 (major, skip) | Easy patches can land in a small dep-bump PR — no security urgency, hygiene only | H |

## 4. OWASP Top 10 (2021) coverage matrix

| Category | Status | Evidence |
|---|---|---|
| A01 Broken access control | ⚠️ | Server-side gating consistent (B-06, S-03). Edge case: missing `user_profile` (S-04). Defense-in-depth gap: no `trustedOrigins` (S-18) |
| A02 Cryptographic failures | ✅ mostly | Strong secret enforcement (S-01, S-15), no NEXT_PUBLIC leaks (S-13), HttpOnly+Secure cookies. PII at rest plaintext (S-28, accepted) |
| A03 Injection | ✅ mostly | Drizzle parameterized (S-10), Zod at boundaries (S-07), no inner HTML (S-12). **Open: email header injection in messageUser (S-25)** |
| A04 Insecure design | ⚠️ | No rate limiting (S-24), no audit log (S-19) |
| A05 Security misconfiguration | ❌ | **No security headers (S-16)**, container as root (I-03) |
| A06 Vulnerable & outdated components | ⚠️ | 7 moderate transitive vulns, 0 high/critical (D-03). Real exploitation paths don't apply to deployment shape |
| A07 Identification & auth failures | ⚠️ | Strong baseline (Better Auth + TOTP + 64-hex secret); gap = rate limiting (S-24); weak min-password floor for ADMIN (S-08) |
| A08 Software & data integrity | ✅ | CI builds from source, GHCR-tagged by SHA, no plaintext secrets in workflows |
| A09 Logging & monitoring | ❌ | No audit log (S-19); only `console.error` |
| A10 SSRF | ✅ | No user-controlled fetch / image-domain allowlist (S-21) |

## 5. Next.js 16 best-practices checklist

- [x] App Router with route groups (`(dashboard)`)
- [x] Server-side session validation in layout (not middleware)
- [x] Async `params: Promise<...>` pattern (Next 16)
- [x] `output: "standalone"` + `outputFileTracingRoot` for monorepo
- [x] React Compiler enabled
- [x] Server Actions wrapped with permission + Zod
- [x] On-demand `revalidatePath` after mutations
- [x] Suspense around `useSearchParams()` (`set-password/page.tsx`)
- [x] Static export for homepage
- [x] No unnecessary `"use client"` (login/set-password correctly client; dashboard pages stay server)
- [ ] `error.tsx` / `not-found.tsx` boundaries (B-04)
- [ ] `headers()` for security headers (S-16)

## 6. shadcn/ui & Tailwind checklist

- [x] `components.json` aliases match real paths
- [x] 16 primitives present, excluded from Biome lint
- [x] Radix-backed dialog/popover/dropdown/select/command (free a11y)
- [x] CSS variables for theming
- [x] `cn()` utility used for conditional classes
- [x] Form fields use shadcn `<Form>` with `aria-describedby` / `aria-invalid`
- [ ] Reach for `cva` once badge/button variants grow (D-05)
- [ ] No automated a11y test (axe-core) — see Testing gaps

## 7. Testing gaps

1. **Email header injection** (T-06 → S-25): no test exercises CR/LF in `messageUser` subject.
2. **Profile-less user** (T-07 → S-04): regression seen live 2026-05-09; no smoke test pins behavior.
3. **No automated a11y test**: dialogs/popovers come a11y-correct from Radix; custom forms (EventForm with calendar + assignee picker) drift over time. Add `@axe-core/playwright` or `vitest-axe` for events form.
4. **No CI gate on Lighthouse**: script exists; CI doesn't enforce baseline.
5. **No load/auth-bruteforce test**: tied to S-24 — once rate limiting in, smoke-test 429 on exhaustion.
6. **Down-migration** (I-05): no rehearsal of "migration fails on boot" recovery.

## 8. Performance / SEO gaps

- Lighthouse not enforced in CI (E-01) — easy CI win: gate on LCP/CLS in `verify`.
- Homepage `images: { unoptimized: true }` correct for static export but raw bytes served — confirm `background.webp` is reasonably sized.
- No `next-sitemap` / `sitemap.ts` in homepage — leave indexing to crawl discovery; add explicit sitemap if site grows.
- Admin `metadata.robots = { index: false, follow: false }` correct, but consider also `noindex` meta tag in rendered HTML in case bunny container is fronted by misconfigured CDN.

## 9. Dependency & supply-chain risks

- `npm audit --omit=dev` re-run 2026-05-09: **7 moderate, 0 high, 0 critical**. See D-03.
- No `pre/post/prepare` scripts → low lifecycle-hook risk.
- Framework versions modern; Better Auth on `^1.6.9` (ranged) — fine.
- No SBOM / Dependabot config visible — adding Dependabot for root `package.json` and GHA workflow is one small PR.

## 10. Suggested follow-up tasks (ordered by risk × effort)

| # | Task | Effort | Risk reduced |
|---|---|---|---|
| 1 | **Add security headers** to `apps/admin/next.config.ts` (`headers()` with CSP/HSTS/XFO/Referrer/Permissions). Start permissive, tighten | S | High (S-16) |
| 2 | **Drop container privileges**: `USER app` in `apps/admin/Dockerfile` | S | High (I-03) |
| 3 | **Strip CR/LF in messageUser/messageEventAssignees**: Zod transform on `subject`. Add smoke test | S | M-H (S-25, T-06) |
| 4 | **Rate limit Better Auth endpoints**: in-memory sliding window OK for single container | M | High (S-24) |
| 5 | **Audit log table + emit from `withPermission`**: 1 schema migration + 1 helper | M | Medium (S-19) |
| 6 | **`error.tsx` + `not-found.tsx`** under `(dashboard)` and root | XS | Medium (B-04) |
| 7 | **Smoke test: profile-less user denies all actions**. Pins 2026-05-09 incident as regression | XS | Medium (S-04, T-07) |
| 8 | **Down-migration runbook** in `kb/runbooks/` | XS | Medium (I-05) |
| 9 | **Bump min password to 12** (login-schema) + UI hint | XS | Low (S-08) |
| 10 | **Add `trustedOrigins` to Better Auth** config | XS | Low (S-18) |
| 11 | **Dep-bump PR**: react@19.2.6, tailwind@4.3.0, resend@6.12.3 (hygiene; no urgency) | XS | Low (D-04) |
| 12 | **Lighthouse CI gate** | M | Low-medium |
| 13 | **`@axe-core/playwright`** for events form | S | Low-medium |
| 14 | **Dependabot config** at repo root | XS | Low |

## What was not verified in this session

- **`messageEventAssignees` exact CR/LF handling** (S-25): inferred parity with `messageUser`; quick re-read recommended before patching.
- **PII volume / GDPR scope** (S-28): no full catalogue of write sites for PII fields. Severity Low under assumption that bunny.net container DB perimeter is the threat boundary.
- **Better Auth `trustedOrigins` API shape** (S-18): worth quick docs check against `node_modules/better-auth` before adding (per CLAUDE.md: this is not the framework set you know).
