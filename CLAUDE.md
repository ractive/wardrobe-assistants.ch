# General
Use agents for implementation tasks whenever possible.

# Admin app architecture

When working in `apps/admin/` or `packages/db/`, read [`kb/admin-architecture/overview.md`](kb/admin-architecture/overview.md) first. It's a short summary of the architectural rules (folder layout, type contracts, permissions, services, UI stack) with links to detailed docs per topic and a [decision log](kb/admin-architecture/decision-log.md) recording *why* each rule exists. Don't break the rules without first reading the relevant ADR — there's usually a reason.

**Adding a new feature slice** (events, services, etc.) — follow [`kb/admin-architecture/feature-slice-template.md`](kb/admin-architecture/feature-slice-template.md). It's a concrete file-by-file checklist that iter-16 onward copy from. Smoke tests (`apps/admin/src/test/http-harness.ts` + `*.smoke.test.ts`) against the real auth + Drizzle path are mandatory per slice (the iter-15b/iter-15c motivation).

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
Use ff-rdp (ff-rdp --help) to debug browser issues (instead of the chrome mcp server). Collect feedback (issues, quirks, improvement ideas) about ff-rdp in kb/tool-reports.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Quality gates

Before any commit:

1. `npm run format` — auto-fix formatting (Biome, write).
2. `npm run verify` — `lint && typecheck && test`. Stops at first failure.
3. `npm run verify:tf` — `tofu fmt -check && tofu validate` (only when `infra/terraform/**` changed; requires `tofu init` first).

Read-only snapshot fixtures (`kb/bunny-snapshot-*/**`) and TF (`infra/terraform/**`) are excluded from Biome via `biome.json` — don't loosen the exclusions to "fix" formatter complaints.
