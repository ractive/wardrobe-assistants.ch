---
title: Iteration 14 — Architecture foundation for the admin app
type: iteration
order: 15
status: done
---

# Iteration 14 — Architecture foundation for the admin app

Land the architecture decided across [ADR-001…ADR-015](../../admin-architecture/decision-log.md). Zero feature code — this iteration sets up the patterns that iter-15..iter-18 fill in. Two outcomes when this lands: (1) `lib/permissions.ts` exists with the catalog and helpers, and (2) `npx shadcn add button` produces a working themed button. The next iteration starts on the users feature with no foundation work to redo.

## Context — why a separate iteration

Cramming the foundation into iter-15's "add a users page" would mix architectural changes with feature work. Every PR-review on iter-15 would have to evaluate "is this perm helper right?" alongside "does the invite form do the right thing?" — too many concerns. iter-14 lands the patterns isolated; iter-15 then becomes a clean exercise of those patterns.

## Pre-flight

- [ ] Confirm the architecture docs in `kb/admin-architecture/` reflect intent (overview + 6 detail docs + decision log). Re-read once before coding.
- [ ] Read [folder-structure.md](../../admin-architecture/folder-structure.md) and [auth-and-permissions.md](../../admin-architecture/auth-and-permissions.md) end-to-end — they're the spec for this iteration.

> _Pre-flight reads aren't visible in the merged diff; left unchecked per "verify against the diff" policy, but the implementation that landed is consistent with having read them._

## Scope — TypeScript foundation [3/3]

- [x] Create `tsconfig.base.json` at repo root with the strict-plus bundle (see [typescript-conventions.md](../../admin-architecture/typescript-conventions.md)).
- [x] Update `apps/admin/tsconfig.json`, `packages/db/tsconfig.json`, `apps/homepage/tsconfig.json` to `extends` the base. Bump homepage `target` from `ES2017` → `ES2022`.
- [x] Run `npm run typecheck`. Fix surfaced issues from `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (auto-fix `import type` via Biome's `useImportType` rule). Estimate: 15–30 min.

## Scope — Biome cross-feature isolation [1/2]

- [x] Add per-feature override blocks to `biome.json` (see [folder-structure.md](../../admin-architecture/folder-structure.md)). For now, just the `lib/`/`components/`/`hooks/` ⇏ `features/**` rule is meaningful (no features exist yet); per-feature overrides are added inside iter-15..iter-18 as features land.
- [ ] Add a doc comment at the top of `biome.json` explaining the override pattern: "When adding a new feature, add an override block forbidding it from importing any other feature's `@/features/<other>/**`." _(Not landed — `biome.json` has the override blocks but no top-of-file explanatory comment.)_

## Scope — `packages/db` schema split [3/3]

- [x] Create `packages/db/src/schema/auth.ts`. Move the current Better Auth tables (user, session, account, verification, twoFactor) into this file from `packages/db/src/schema.ts`.
- [x] Create `packages/db/src/schema/users.ts` with the `userProfile` table (see [data-layer.md](../../admin-architecture/data-layer.md) for the Drizzle definition).
- [x] Update `packages/db/src/schema.ts` to be the aggregator: `export * from "./schema/auth"; export * from "./schema/users"`. Run `npm run typecheck` to confirm imports across the codebase still resolve.

## Scope — Drizzle migration [2/2]

- [x] Generate the migration with `drizzle-kit generate` (creates a SQL file under `packages/db/migrations/`). Verify the diff: only `user_profile` table added, no churn on existing tables.
- [x] Apply against local dev DB: `npm -w @wardrobe-assistants/admin run migrate`. Apply against prod is **out of scope for this iteration** — landed manually after iter-15 needs it (see iter-15 pre-flight). _(Implicitly verified: iter-15 successfully built on top of `user_profile`.)_

## Scope — Better Auth session-customisation [2/2]

- [x] Update `apps/admin/src/lib/auth.ts` to add `additionalFields` for `firstName`, `lastName`, `nickname`, `role`, `status` on the session. Configure the session-create hook that reads from `user_profile` by `userId` and merges these fields. Reference [auth-and-permissions.md](../../admin-architecture/auth-and-permissions.md).
- [x] Add `getCurrentUserRole()` helper in `lib/auth.ts`: reads session, returns `Role | null`. This is the seam `lib/permissions.ts` uses (no cross-feature import).

## Scope — Permissions registry + helpers [4/4]

- [x] Create `apps/admin/src/lib/permissions.ts` with:
  - `ROLES` const + `Role` type.
  - `PERMISSIONS` const + `Permission` type (initial catalog from [auth-and-permissions.md](../../admin-architecture/auth-and-permissions.md): users, events, squad).
  - `ROLE_PERMISSIONS` map (`ADMIN: new Set(PERMISSIONS)`, `SQUAD_MEMBER` whitelist).
  - Module-load self-check.
  - Custom error classes: `UnauthenticatedError`, `PermissionError`.
  - `userHasPermission`, `assertPermission`, `withPermission` helpers.
- [x] Add unit tests `lib/permissions.test.ts` covering: ADMIN has every perm; SQUAD_MEMBER has only the two whitelisted; missing role returns false / throws; the self-check fires on a synthetic "perm declared but not granted" case.
- [x] Create `components/HasPermission.tsx` — async server component with `perm` prop, optional `fallback`.
- [x] Create `components/NoPermissionCard.tsx` — small card UI for the fallback (will use shadcn primitives once installed below).

## Scope — Client perm hook [1/1]

- [x] Create `apps/admin/src/hooks/use-has-permission.ts` — `useHasPermission(perm)` hook reading `authClient.useSession()` against the imported `ROLE_PERMISSIONS` map (isomorphic).

## Scope — shadcn/ui init + first components [3/3]

- [x] Run `npx shadcn@latest init` in `apps/admin/`. Confirm `components.json` shape per [ui-stack.md](../../admin-architecture/ui-stack.md). Verify `lib/utils.ts` (with `cn()` helper) is created — it shouldn't conflict with our existing files.
- [x] Install initial primitives: `npx shadcn add button input label form dialog table dropdown-menu select textarea checkbox sonner card`. Each lands in `components/ui/`.
- [x] Wire `<Toaster />` from `sonner` into `app/(dashboard)/layout.tsx` so toasts render globally.

## Scope — package additions [2/2]

- [x] Add deps to `apps/admin/package.json`: `@tanstack/react-table`, `date-fns`. Run `npm install`.
- [x] Confirm lockfile updated; commit.

## Scope — consolidate email service [3/3]

- [x] Delete `apps/admin/src/lib/mail.ts`. Move its dev-fallback logic into `apps/admin/src/lib/email.ts`. Switch `lib/email.ts`'s Resend construction to lazy (inside the function), matching the consolidated pattern.
- [x] Add `apps/admin/src/lib/__mocks__/email.ts` — pre-stubbed `sendEmail` mock (returns `undefined`). Vitest auto-uses on `vi.mock("@/lib/email")`.
- [x] Update Better Auth's `sendResetPassword` and `sendVerificationEmail` callers to use the consolidated `sendEmail` (no behavioural change).

## Scope — README / docs touch-ups [2/2]

- [x] Update root `README.md`'s "Project layout" section to mention `apps/admin/src/features/`, `apps/admin/src/components/ui/`, and `kb/admin-architecture/`.
- [x] Update `AGENTS.md` to point AI agents at `kb/admin-architecture/overview.md` for any admin-app work. _(Note: post-iter-14, `AGENTS.md` was merged into `CLAUDE.md` and removed; the architecture pointer is preserved there.)_

## Verify [2/3]

- [x] `npm run verify` (root) passes — Biome lint clean, typecheck clean, all 21+ existing tests + new perm tests pass.
- [ ] `npm run dev:admin` boots; sign-in still works; an authenticated session shows the dashboard layout (no regressions from iter-13). _(Manual smoke test, not visible in the merged diff; left unchecked per "verify against the diff" policy.)_
- [x] `npx shadcn add badge` adds a new component cleanly (smoke-test for shadcn integration).

## Out of scope (deliberate)

- **Any feature code** (no users page, no events page, no services page). iter-15+ each take one feature.
- **Prod migration of `user_profile`** — applied automatically by the admin runtime's migrate-on-boot path the first time iter-15 deploys to prod.
- **Filling out `user_profile` data for the seeded admin user** — the seed script (iter-13's `seed-admin.ts`) gets updated to also insert a `user_profile` row in iter-15, since iter-15 is what actually queries it.
- **MFA enforcement for admin role** — deferred to iter-19.
- **Audit service** — deferred until a feature actually wants it (iter-15's invite flow is a candidate).

## Critical files

New:
- `tsconfig.base.json`
- `packages/db/src/schema/auth.ts` (extracted from existing `schema.ts`)
- `packages/db/src/schema/users.ts`
- `packages/db/migrations/<timestamp>_user_profile.sql`
- `apps/admin/src/lib/permissions.ts`
- `apps/admin/src/lib/permissions.test.ts`
- `apps/admin/src/lib/__mocks__/email.ts`
- `apps/admin/src/components/HasPermission.tsx`
- `apps/admin/src/components/NoPermissionCard.tsx`
- `apps/admin/src/hooks/use-has-permission.ts`
- `apps/admin/components.json` (shadcn CLI)
- `apps/admin/src/components/ui/*.tsx` (shadcn primitives)
- `apps/admin/src/lib/utils.ts` (shadcn `cn()` helper)

Edited:
- `packages/db/src/schema.ts` (now an aggregator)
- `apps/admin/tsconfig.json`, `packages/db/tsconfig.json`, `apps/homepage/tsconfig.json`
- `biome.json`
- `apps/admin/src/lib/auth.ts` (additionalFields + session hook + getCurrentUserRole)
- `apps/admin/src/lib/email.ts` (consolidated)
- `apps/admin/package.json` (new deps)
- `README.md`, `AGENTS.md`

Deleted:
- `apps/admin/src/lib/mail.ts` (folded into email.ts)

## Risks / things that could bite

- **`noUncheckedIndexedAccess` migration noise.** Will surface 5–20 spots needing `if (!x) throw ...` or `arr.at(0)`. Each is a 1-liner; bound the cost by doing them all at once after enabling.
- **Better Auth `additionalFields` shape.** The session hook needs the right return shape; a bad merge could shadow built-in BA fields. Test by signing in and inspecting `session.user` — confirm both BA fields and our additions are present.
- **shadcn init may overwrite `lib/utils.ts`.** We don't have one yet, so this is fine on first init. Verify post-init that no existing file was clobbered.
- **`packages/db/src/schema.ts` breaking change.** Move-and-aggregate must keep all existing `from "@wardrobe-assistants/db/schema"` imports working. Aggregator pattern is `export *` — should be transparent. Run typecheck across both apps to confirm.

## Done when [5/6]

- [x] `lib/permissions.ts` is the catalog + helpers + tests, and a test like `await userHasPermission("EVENT_CREATE")` returns `true` for ADMIN, `false` for SQUAD_MEMBER.
- [ ] A throw-away `<HasPermission perm="USER_INVITE">hello</HasPermission>` in a server component renders or hides depending on the seeded admin's role. _(Manual smoke test; not visible in diff. Formal coverage is in `permissions.test.ts`.)_
- [x] `npx shadcn add badge` works without manual config.
- [x] `npm run verify` is green.
- [x] Architecture overview + 6 detail docs + decision log are in `kb/admin-architecture/` (already authored — this iter just keeps them up-to-date if the implementation deviates).
- [x] iter-15 can be opened immediately with the foundation in place.
