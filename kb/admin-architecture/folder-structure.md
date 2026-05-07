---
title: Folder structure & cross-feature isolation
type: architecture
status: current
---

# Folder structure & cross-feature isolation

Inspired by the WebDevSimplified [feature-folder pattern](https://github.com/WebDevSimplified/parity-deals-clone/tree/feature-folder-structure), adapted for our `packages/db` setup.

## Layout

```
apps/admin/src/
  app/                              # Next.js routes — thin pages (≤30 lines)
    (dashboard)/
      users/page.tsx                  # imports from features/users/components/
      events/page.tsx
      services/page.tsx
    api/auth/[...all]/route.ts        # Better Auth catchall (framework integration)
    login/page.tsx
  features/                         # vertical slices — one feature per folder
    <f>/
      schema.ts                       # Zod input + output schemas (NOT DB tables)
      server/
        queries.ts                    # called from server components
        actions.ts                    # "use server" mutations
      components/                     # feature-specific React (forms, tables, dialogs)
      # plurals (schemas/, queries/, actions/, components/forms/) only when a file > ~300 lines
  components/                       # cross-feature React
    HasPermission.tsx                 # RSC permission gate
    NoPermissionCard.tsx
    DashboardSidebar.tsx              # shared layout components
    ui/                               # shadcn/ui primitives — added via `npx shadcn add <name>`
  hooks/                            # cross-feature React hooks (added when ≥2 features need a hook)
  lib/                              # cross-cutting non-React infra
    auth.ts                           # Better Auth config + getCurrentUserRole helper
    auth-client.ts                    # Better Auth client SDK
    db.ts                             # Drizzle client
    email.ts                          # Resend wrapper (consolidates iter-13's mail.ts)
    env.ts                            # Zod-validated env loader (iter-13)
    permissions.ts                    # PERMISSIONS catalog + ROLE_PERMISSIONS map + helpers
    utils.ts                          # cn() helper for shadcn — comes via `npx shadcn init`
  middleware.ts                     # Next.js middleware (auth redirect)

packages/db/src/
  schema.ts                         # aggregator — re-exports schema/*.ts
  schema/
    auth.ts                           # Better Auth tables (existing)
    users.ts                          # user_profile (1:1 with auth.user)
    events.ts                         # events feature tables
    services.ts                       # services feature tables
  client.ts                         # createDb({url, authToken}) factory
  index.ts
  migrations/                       # drizzle-kit output
```

## Boundary rule for new files

Two-question test:

1. **Is it used by exactly one feature?** → `features/<f>/`
2. **Otherwise — is it React (component or hook) or non-React?**
   - React component → `components/`
   - React hook → `hooks/`
   - Non-React server/edge → `lib/`

**Promotion:** when a feature-local thing starts being used by a second feature, *move* it (don't cross-import). The Biome rule below makes this mandatory anyway.

**Demotion:** if a `components/`/`hooks/`/`lib/` thing is actually only used by one feature, move it back. Keeps the shared layer tight.

## What goes where (the ambiguities)

| Asked-where-does-this-go | Goes |
|---|---|
| Type aliases like `type EventStatus = "draft" \| "published"` | Alongside the schema that defines them — `Zod.infer<>` does most of this; explicit types live in the feature's `schema.ts` |
| Shared constants (`MAX_UPLOAD_BYTES`, etc.) | `lib/constants.ts` if cross-cutting; in the feature's `schema.ts` or a feature-local `constants.ts` if feature-local |
| Tests | Colocated next to source: `features/users/server/queries.test.ts` lives next to `queries.ts` |
| `app/api/auth/[...all]/route.ts` | Stays in `app/` — it's a Next.js framework integration point, not feature code |
| Drizzle table for a feature | `packages/db/src/schema/<f>.ts` — NOT inside `features/<f>/` |
| Zod input/output schemas | `apps/admin/src/features/<f>/schema.ts` — NOT in `packages/db` |
| PDF generation, calendar invite generation | If cross-cutting → `lib/`; if only one feature ever uses it → that feature's `server/` |
| Layout components (sidebar, page-header) | `components/` (cross-feature) |
| Page-route components | `app/(dashboard)/<feature>/page.tsx` — thin, composes feature components |

## Cross-feature isolation (Biome)

Enforced via `biome.json`'s `noRestrictedImports` with **per-feature overrides**. The rule:

- Files in `apps/admin/src/features/<X>/**` may **not** import from `@/features/<other>/**`.
- Files in `apps/admin/src/{lib, components, hooks}/**` may **not** import from `@/features/**`.

Concrete pattern (per-feature override per feature):

```jsonc
// biome.json
{
  "overrides": [
    {
      "includes": ["apps/admin/src/features/users/**"],
      "linter": { "rules": { "style": { "noRestrictedImports": { "level": "error",
        "options": { "patterns": [
          { "group": ["@/features/events/**", "@/features/services/**"],
            "message": "Cross-feature import. Go through lib/ or compose at the page." }
        ] } } } } }
    },
    // …same for events, services
    {
      "includes": ["apps/admin/src/lib/**", "apps/admin/src/components/**", "apps/admin/src/hooks/**"],
      "linter": { "rules": { "style": { "noRestrictedImports": { "level": "error",
        "options": { "patterns": [
          { "group": ["@/features/**"], "message": "Shared code may not import from features." }
        ] } } } } }
    }
  ]
}
```

Adding a new feature = add one more override block targeting `features/<new>/**` that forbids each existing feature.

### The `lib/permissions.ts` exception (and why we don't need one)

`lib/permissions.ts` looks up the current user's role to decide perms. Naively it would import from `@/features/users/server/queries` — but our Biome rule forbids that. The architectural fix: `lib/permissions.ts` reads role via `lib/auth.ts` (which holds a small `getCurrentUserRole()` helper). `lib/` ↔ `lib/` import — allowed. No exception needed.

## Composition at the page level is fine

A route page in `app/(dashboard)/dashboard/page.tsx` may freely import from any feature:

```tsx
import { UsersTable } from "@/features/users/components/UsersTable"
import { EventsList } from "@/features/events/components/EventsList"

export default async function DashboardPage() {
  return <><UsersTable /><EventsList /></>
}
```

That's the *legit* path for cross-feature composition — let the route compose, don't have features call each other.
