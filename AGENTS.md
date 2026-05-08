# General
Use agents for implementation tasks whenever possible.

# Admin app architecture

When working in `apps/admin/` or `packages/db/`, read [`kb/admin-architecture/overview.md`](kb/admin-architecture/overview.md) first. It's a short summary of the architectural rules (folder layout, type contracts, permissions, services, UI stack) with links to detailed docs per topic and a [decision log](kb/admin-architecture/decision-log.md) recording *why* each rule exists. Don't break the rules without first reading the relevant ADR — there's usually a reason.

The shared layers are:
- `apps/admin/src/lib/` — cross-cutting non-React infra (`auth.ts`, `db.ts`, `email.ts`, `env.ts`, `permissions.ts`, `utils.ts`)
- `apps/admin/src/components/` — cross-feature React (incl. `HasPermission.tsx`, `NoPermissionCard.tsx`, and `components/ui/` for shadcn primitives)
- `apps/admin/src/hooks/` — cross-feature React hooks (e.g. `use-has-permission.ts`)
- `apps/admin/src/features/<f>/` — vertical slices, populated by iter-15+

Cross-feature isolation is enforced by Biome (`biome.json`'s `noRestrictedImports` overrides). Shared code may not import from `features/`; each feature is forbidden from importing other features. Add a per-feature override block when introducing a new feature.

Permissions live in `apps/admin/src/lib/permissions.ts` (catalog + `userHasPermission` / `assertPermission` / `withPermission` helpers). Server-side gating: `<HasPermission>`. Client-side gating: `useHasPermission`. Roles are read from the Better Auth session (`session.user.role`), merged in via the session-create hook in `lib/auth.ts`.

# bunny.net services
If you manage bunny.net services, use the "hoppy" CLI tool (hoppy --help) to discover and debug things.

# Browser debugging
If you need to debug something in the browser, use the ff-rdp CLI tool (ff-rdp --help) in favor of the chrome mcp server. Collect feedback about ff-rdp in the kb knowledgebase.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
