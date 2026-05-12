# General
Use agents for implementation tasks whenever possible.

# Admin app architecture

When working in `apps/admin/` or `packages/db/`, read [`kb/admin-architecture/overview.md`](kb/admin-architecture/overview.md) first. It's a short summary of the architectural rules (folder layout, type contracts, permissions, services, UI stack) with links to detailed docs per topic and a [decision log](kb/admin-architecture/decision-log.md) recording *why* each rule exists. Don't break the rules without first reading the relevant ADR — there's usually a reason.

**Adding a new feature slice** (events, services, etc.) — follow [`kb/admin-architecture/feature-slice-template.md`](kb/admin-architecture/feature-slice-template.md). It's a concrete file-by-file checklist that iter-16 onward copy from. Smoke tests (`apps/admin/src/test/http-harness.ts` + `*.smoke.test.ts`) against the real auth + Drizzle path are mandatory per slice (the iter-15b/iter-15c motivation).

**Building UI** — start at [`kb/admin-architecture/design-system/README.md`](kb/admin-architecture/design-system/README.md) (wiki hub). One sub-page per topic — `tokens.md`, `breakpoints.md`, `spacing.md`, `typography.md`, `layout-primitives.md`, `forms.md`, `tables.md`, `dialogs-and-sheets.md`, `status-badges.md`, `icons.md`, `permission-gating-ui.md`, `a11y.md`, `animation.md`, `anti-patterns.md`, `blocks.md`, `theme.md`. Read the one you need, not the whole set. Mobile-first; admin must work at 375px. `vitest-axe` per interactive component.

**Audit findings** (security + frontend) live in [`kb/audits/`](kb/audits/). Before any UI or security work, check [`kb/audits/findings-index.md`](kb/audits/findings-index.md) — it maps every consolidated finding ID (`C-SEC-XX`, `F-FE-XX`) to its target iteration with live status. The post-iter-16 hardening sequence (iter-16b..16g) closes most of them; don't bypass unless the finding is explicitly marked deferred or accepted.

The shared layers are:
- `apps/admin/src/lib/` — cross-cutting non-React infra (`auth.ts`, `db.ts`, `email.ts`, `env.ts`, `permissions.ts`, `utils.ts`)
- `apps/admin/src/components/` — cross-feature React (incl. `HasPermission.tsx`, `NoPermissionCard.tsx`, and `components/ui/` for shadcn primitives)
- `apps/admin/src/hooks/` — cross-feature React hooks (e.g. `use-has-permission.ts`)
- `apps/admin/src/features/<f>/` — vertical slices, populated by iter-15+

Cross-feature isolation is enforced by Biome (`biome.json`'s `noRestrictedImports` overrides). Shared code may not import from `features/`; each feature is forbidden from importing other features. Add a per-feature override block when introducing a new feature.

Permissions live in `apps/admin/src/lib/permissions.ts` (catalog + `userHasPermission` / `assertPermission` / `withPermission` helpers). Server-side gating: `<HasPermission>`. Client-side gating: `useHasPermission`. Roles are read from `user_profile` at permission-check time via `roleForUserId(userId)` in `lib/auth.ts` — `withPermission` does the lookup automatically. (Earlier iter-15 plan to merge role into the session via Better Auth `additionalFields` was a no-op; see iter-15c.)

# bunny.net services
If you manage bunny.net services, use the "hoppy" CLI tool (hoppy --help) to discover and debug things.

# Browser debugging
Use ff-rdp (`ff-rdp --help`) for browser debugging *and* visual inspection (instead of the chrome MCP server). After any session that exercises ff-rdp non-trivially, append a dogfooding report at `../ff-rdp/kb/dogfooding/dogfooding-session-<NN>.md` (next sequential number — `ls ../ff-rdp/kb/dogfooding/` to find it). Record what worked, what didn't, bugs, quirks, and improvement ideas. Other tool feedback (hoppy, hyalo, bunnyway-actions) still goes in this repo's `kb/tool-reports/`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Quality gates

Before any commit:

1. `npm run format` — auto-fix formatting (Biome, write).
2. `npm run verify` — `lint && typecheck && test`. Stops at first failure.
3. `npm run verify:tf` — `tofu fmt -check && tofu validate` (only when `infra/terraform/**` changed; requires `tofu init` first).

Standalone checks (run when relevant; not in `verify`):

- `npm run check:contrast` — iter-38 §B. Re-derives WCAG AA contrast ratios for every documented `:root` + `.dark` token pair in `apps/admin/src/app/globals.css`. Run after any palette / theme-token edit. Standalone (not in `verify`) because the current bordeaux palette has known fails recorded in `kb/audits/iter-38-manual-verification.md` for iter-38b to fix.
- `npm run smoke:public` — iter-38 §D. Curls the admin's public proxy paths + the homepage `/booking-request` catalog endpoint against prod (override via `BASE_URL`). Run post-deploy.

Read-only snapshot fixtures (`kb/bunny-snapshot-*/**`) and TF (`infra/terraform/**`) are excluded from Biome via `biome.json` — don't loosen the exclusions to "fix" formatter complaints.
