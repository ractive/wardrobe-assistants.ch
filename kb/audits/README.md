---
title: Audits index
type: index
status: current
---

# Codebase audits

Each audit captures a snapshot of the repo at a point in time. Source documents (per-reviewer) are preserved verbatim; the consolidated documents are the actionable summaries; the [findings index](findings-index.md) maps every consolidated finding ID to its target iteration.

## Quick navigation

- **[Findings index](findings-index.md)** — single source of truth for "where does each finding land?" Maps every audit ID (`C-SEC-XX`, `F-FE-XX`) to its iteration with status.
- **[Security consolidated](audit-2026-05-09-consolidated.md)** — three-reviewer security/architecture audit, reconciled.
- **[Frontend consolidated](audit-2026-05-09-frontend-consolidated.md)** — three-reviewer frontend/UI audit, reconciled, with design-system landscape research.

## 2026-05-09 — Three-reviewer security/architecture audit (post-iter-16)

Triggered after iter-16 (events feature) merge. Scope: architecture, Next.js 16, React 19/TypeScript, shadcn/Tailwind, security (OWASP 2021/2025), testing, performance/SEO, infrastructure, dependencies.

- [Consolidated audit](audit-2026-05-09-consolidated.md) — reviewer-coverage matrix, Top 12 findings, prioritized action plan, OWASP coverage.
- Source documents:
  - [Claude Opus 4.7](audit-2026-05-09-claude-opus.md) — strong on app-logic findings (email header injection, missing-profile denial, test gaps). Re-ran `npm audit` and corrected severity.
  - [GitHub Copilot](audit-2026-05-09-copilot.md) — strong on operational/infra. Caught CDN cache-with-cookies, GHA `@main`, temp-admin script. Ran `npm ci` + full build/test pipeline locally.
  - [ChatGPT](audit-2026-05-09-chatgpt.md) — strong on policy gaps (CI lint, `requireEmailVerification`, `skipLibCheck`).

**Top 6 high-severity items (consolidated):**

1. C-SEC-04 — Admin pull-zone caches with cookies, no app-side `Cache-Control`
2. C-SEC-01 — No security headers / CSP
3. C-SEC-03 — `BunnyWay/actions/container-update-image@main` mutable ref
4. C-SEC-05 — `seed-temp-admin` no production guard, no 2FA
5. C-SEC-02 — No rate limiting on auth endpoints
6. C-SEC-06 — Admin container runs as root

## 2026-05-09 — Three-reviewer frontend audit

Same triple-review pattern, focused on UI quality, component architecture, accessibility, design-system consistency, Tailwind hygiene, performance, and testing.

- [Consolidated frontend audit](audit-2026-05-09-frontend-consolidated.md) — reviewer-coverage matrix, Top 12 findings, design-system landscape research, prioritized action plan.
- Source documents:
  - [Claude Opus 4.7](audit-2026-05-09-frontend-deep.md) — strong on form-pattern duplication, badge drift, SignOutButton silent-failure, React-Compiler-vs-`useMemo` tension.
  - [GitHub Copilot](audit-2026-05-09-frontend-copilot.md) — strong on operational gaps (TanStack overkill, mobile-nav missing, wrong permission, dead `<Check>`, redundant Open column, unused `--radius-m`, Unicode arrow, duplicate `getSession`). Ran build pipeline locally.
  - [ChatGPT](audit-2026-05-09-frontend-chatgpt.md) — strong on a11y angle (live regions, design-token duplication, mobile-nav checkbox-hack risks).

**Top 5 frontend items (consolidated):**

1. F-FE-01 — Login page bypasses shadcn `<Form>`/`<Input>`/`<Button>`
2. F-FE-03 — TanStack Table loaded for read-only tables (~20-30 KB unnecessary client JS)
3. F-FE-04 — No `loading.tsx` / `error.tsx` / `not-found.tsx` boundaries
4. F-FE-05 — Admin entirely inaccessible on mobile (sidebar `hidden md:block`)
5. F-FE-06 — No `aria-current="page"` on active sidebar links

**Design-system decision (from research):** stay on stock shadcn/ui. Adopt the official `Sidebar` and `<Form>` everywhere. Defer Tremor/Charts until analytics surface lands. Don't adopt community shadcn extensions (Origin UI, Cult UI, Aceternity) — drift risk outweighs value at this scale. Mobile-responsive is a first-class design-system concern (admins manage from phones).

## Post-audit iteration plan

The findings flow into a six-iteration arc between iter-16 (events, merged) and iter-17 (services, planned). Each row maps to a planned-status iteration plan:

| Iter | Order | Theme |
|---|---|---|
| [16b](../iterations/iteration-16b-edge-hardening.md) | 17.3 | Security & edge hardening |
| [16c](../iterations/iteration-16c-design-system-foundation.md) | 17.4 | Design system foundation (doc + responsive baseline + vendor primitives) |
| [16d](../iterations/iteration-16d-ui-cleanup-nav-data.md) | 17.5 | UI cleanup pass 1 (sidebar, tables, quick wins) |
| [16e](../iterations/iteration-16e-ui-cleanup-forms-boundaries.md) | 17.6 | UI cleanup pass 2 (forms, boundaries, first tests) |
| [16f](../iterations/iteration-16f-defense-in-depth.md) | 17.7 | Defense-in-depth security |
| [16g](../iterations/iteration-16g-login-redesign.md) | 17.8 | Login redesign + load-bearing component tests |

Sequencing rationale: define → clean up → redesign. Mobile-responsive is woven into the design-system doc and applied as each cleanup iteration touches its components. iter-16f (server-only defense-in-depth) can run in parallel with the UI track but is plan-ordered after it for clarity. iter-17 inherits the design system, the cleaned-up sidebar/table primitives, the form-action hook, the boundary trio, and the security primitives.

See [findings index](findings-index.md) for the full mapping of audit IDs to iterations.
