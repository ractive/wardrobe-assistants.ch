---
title: Feature slice template
type: architecture
status: current
---

# Feature slice template

The shape every new vertical-slice feature in `apps/admin/src/features/<f>/` follows. iter-16 (events), iter-17 (services), iter-18 (squad views) all copy this template. Use it as a checklist; if any step is missing for a given feature, write down why in the iteration plan.

The canonical reference is iter-15's `apps/admin/src/features/users/`. Read that alongside this doc.

## File layout

```
packages/db/src/schema/<f>.ts            # Drizzle table(s) for the feature
apps/admin/src/features/<f>/
  schema.ts                              # Zod input schemas + ActionResult type
  schema.test.ts                         # Zod boundary tests (accept/reject shapes)
  server/queries.ts                      # `import "server-only"` then read-only Drizzle
  server/actions.ts                      # `"use server"` then withPermission-wrapped
  server/<f>.smoke.test.ts               # HTTP-level integration test (see below)
  server/actions.test.ts                 # Action-level test with mocked DB/auth
  components/                            # RSCs + client components for this feature
biome.json                               # add a per-feature override (see Folder rules)
apps/admin/src/lib/permissions.ts        # add new PERMISSION literals here
```

Plural folders (`server/queries/`, `components/dialogs/`) only when a file grows past one screen. Default flat — premature splitting is worse than re-org later.

## Schema (`packages/db/src/schema/<f>.ts`)

Drizzle SQLite tables live one-per-feature; aggregator in `packages/db/src/schema.ts` re-exports them.

```ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const event = sqliteTable("event", {
  id: text("id").primaryKey(),
  // foreign keys: cascade if the parent row going away should drop the child
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // ...
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
```

Then run `npm -w @wardrobe-assistants/db run db:generate` from the repo root to write a new SQL migration into `packages/db/migrations/`. Commit the SQL file alongside the schema. **Do not edit applied migration files** — Drizzle's journal will refuse to re-apply them.

## Permissions (`apps/admin/src/lib/permissions.ts`)

Add new permission literals to `PERMISSIONS` (the `as const` array) and grant them in `ROLE_PERMISSIONS`. ADMIN defaults to `new Set(PERMISSIONS)` — the catch-all only matters if you later remove it.

```ts
export const PERMISSIONS = [
  // ...existing...
  "EVENT_CREATE",
  "EVENT_DELETE",
] as const;
```

The module-load self-check at the bottom of `permissions.ts` enforces every declared permission is granted to at least one role. Add to `ROLE_PERMISSIONS.SQUAD_MEMBER` explicitly if a non-ADMIN role should also have it.

## Zod schemas (`apps/admin/src/features/<f>/schema.ts`)

One Zod object per server action input + one for the returned shape if it differs from the Drizzle inference. Reuse the `ActionResult` discriminated union from existing features:

```ts
export type ActionResult =
  | { error: false; message: string }
  | { error: true; message: string };
```

Pass empty/null inputs as `undefined` from callers — `.optional()` on a Zod field makes it accept `undefined` but not `null`. Smoke tests caught this on iter-15c (the harness initially passed `null`).

## Server queries (`apps/admin/src/features/<f>/server/queries.ts`)

Always start with `import "server-only";` to hard-fail at build time if the file gets imported into a client bundle. Reads only — mutations live in `actions.ts`. End each query with a `.parse()` against the Zod return shape so the type contract is enforced at the boundary.

## Server actions (`apps/admin/src/features/<f>/server/actions.ts`)

Always start with `"use server";`. Every exported action is `withPermission("PERM", async (actorId, raw) => ...)`. The wrapper:
- runs the auth + permission check by reading `user_profile.role` for the session user (since iter-15c — `session.user.role` is no longer populated; the source of truth is the `user_profile` table)
- injects the actor's user id as the first arg
- throws `UnauthenticatedError` or `PermissionError` on failure (UI catches and 403s)

Action body shape:
1. `safeParse(raw)` against the Zod input schema. Return `{ error: true, message: ... }` on validation failure.
2. Run the DB mutation(s).
3. Side effects (email, etc.) — wrap in try/catch and return a partial-success message rather than throwing if the side effect can be retried later.
4. `revalidatePath("/<f>")` for any list page that needs to reflect the change. Must run **after** side-effect handling (and its try/catch) but **before** the return so the next render reads the new state. Mock `next/cache` in tests.
5. Return `{ error: false, message: ... }`.

## UI components (`apps/admin/src/features/<f>/components/`)

shadcn/ui primitives in `components/ui/` are global. Feature-specific components (forms, tables, dialogs, badges) live here. RHF + zodResolver wires forms to the same Zod input schema the server action uses — the types stay aligned.

Server-side gate route segments with `<HasPermission perm="...">`. Client-side conditional UI uses `useHasPermission("...")`. Never branch on role directly — use the permission catalog.

## Test triad

Three tests per feature, in order of cost-to-write:

### 1. Schema test (`schema.test.ts`)
Zod boundary cases: every required field rejected when missing, every constrained field rejected at the boundary, `optional()` fields accepted as undefined. Cheap and high-signal.

### 2. Action test (`server/actions.test.ts`)
Mocks `@/lib/db`, `@/lib/auth`, `@/lib/permissions`, `@/lib/email`. Exercises action logic — branch coverage on validation paths, success path, partial-success messages. Fast (no DB).

### 3. Smoke test (`server/<f>.smoke.test.ts`) — see [iter-15c's harness](../iterations/iteration-15c-smoke-harness.md)
Real auth + real Drizzle + real `user_profile` permission lookup against a tmp libSQL. Catches the iter-15b class of bug where unit tests pass but the HTTP path 500s in prod.

```ts
import { type Harness, setupHarness } from "@/test/http-harness";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let harness: Harness;

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(harness.activeCookies()),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => {}) }));

describe("<f> feature — smoke", () => {
  beforeAll(async () => { harness = await setupHarness(); });
  afterAll(() => harness.cleanup());

  it("admin can <action>", async () => {
    const admin = await harness.seedAdmin({ email: "...", password: "..." });
    const { actionFn } = await import("./actions");
    const result = await harness.runAs(admin.cookies, () => actionFn({...}));
    expect(result.error, JSON.stringify(result)).toBe(false);
  });

  it("squad member is denied <action>", async () => {
    const sm = await harness.seedSquadMember({ ... });
    const { actionFn } = await import("./actions");
    await expect(
      harness.runAs(sm.cookies, () => actionFn({...})),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });
});
```

The reference smoke is `apps/admin/src/features/users/server/users.smoke.test.ts`. Copy its shape, swap the actions, ship.

## Per-iteration smoke checklist

Every iteration plan's `Verify` section appends the following. Takes ~60 seconds; forces a manual UI pass before merge.

```markdown
- [ ] Local smoke (manual UI pass):
  - [ ] `npm run db:reset:admin` (fresh dev DB + seeded dev admin)
  - [ ] `npm run dev:admin`, sign in at http://localhost:3000/login as `admin@example.com` / `dev-only-not-secure`
  - [ ] Create one of <feature> via the UI
  - [ ] See it in the list / detail page
  - [ ] Sign out
```

## Cross-feature isolation

Add a per-feature override in `biome.json`'s `noRestrictedImports`:

```json
{
  "files": { "include": ["apps/admin/src/features/<f>/**"] },
  "linter": {
    "rules": {
      "correctness": {
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "paths": {
              "@/features/users/**": "Cross-feature import forbidden",
              "@/features/events/**": "Cross-feature import forbidden",
              ...
            }
          }
        }
      }
    }
  }
}
```

The same overrides exist in reverse — the feature can't be imported by other features either. To share code, promote it to `lib/` or `components/`.

## Common pitfalls

- **Forgot to add the SQL migration.** Drizzle generates it, but you have to commit the file. iter-15b's boot-time migrator will catch this in CI's smoke test if you missed it; otherwise the prod boot crash-loops.
- **Wrote a server action that reads `session.user.role`.** Pre-iter-15c, that field was always undefined. Use `withPermission` (it does the user_profile lookup for you) or call `getCurrentUserRole()` / `roleForUserId(userId)` directly.
- **Smoke test fails with `Cannot find package 'server-only'`.** Add `vi.mock("server-only", () => ({}))` at the top of the smoke file — it's not installed in the vitest Node environment.
- **Smoke test fails with `headers() is not a function` or returns empty.** Forgot the `vi.mock("next/headers", () => ({ headers: () => Promise.resolve(harness.activeCookies()) }))` block.
