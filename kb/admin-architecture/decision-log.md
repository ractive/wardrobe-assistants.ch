---
title: Admin app architectural decision log
type: architecture
status: current
---

# Architectural decision log

Each entry: ADR-N, title, status (`accepted` / `superseded` / `rejected`), date decided, the decision, the alternatives considered, and the rationale. Entries below are accepted unless noted otherwise.

When superseding an ADR, mark the old one `superseded` and add a new ADR with reference back. Don't delete history.

---

## ADR-001 — Adopt feature-folder layout under `apps/admin/src/features/`

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Vertical slices live in `apps/admin/src/features/<f>/` with `schema.ts` (Zod), `server/{queries,actions}.ts`, and `components/`. Cross-cutting infra in `lib/`, primitives in `components/`, hooks in `hooks/`, routes in `app/`.

**Alternatives:** WDS feature-folder verbatim with `server/db/`+`server/actions/` split (rejected: extra nesting); top-level `features/` workspace package (rejected: premature packagisation); Next.js-route-folder convention only (rejected: server logic scatters).

**Rationale:** Vertical-slicing matches how features evolve; routes stay thin; a feature's surface is one folder to grep. Layout adapted from [WebDevSimplified's parity-deals-clone](https://github.com/WebDevSimplified/parity-deals-clone/tree/feature-folder-structure) with our flatter naming.

---

## ADR-002 — Drizzle schema split per feature in `packages/db`

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Each feature owns a file at `packages/db/src/schema/<f>.ts`. The aggregator at `packages/db/src/schema.ts` re-exports them all. Drizzle-kit reads the aggregator.

**Alternatives:** A single `packages/db/src/schema.ts` (rejected: file grows unbounded); schema co-located in `apps/admin/src/features/<f>/` (rejected: breaks `packages/db` self-containment for migrations + seed scripts).

**Rationale:** Feature locality at the schema level; aggregator stays trivially simple; `packages/db` remains an importable shared library.

---

## ADR-003 — Cross-feature isolation enforced via Biome

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Adopt Biome's `noRestrictedImports` with per-feature overrides. Features cannot import from other features; `lib/`/`components/`/`hooks/` cannot import from features at all. Adding a new feature adds one override block.

**Alternatives:** Convention-only (rejected: doesn't survive contact with reality); `eslint-plugin-project-structure` (rejected: would add a second linter alongside Biome).

**Rationale:** Build-time enforcement is the cheapest reliable architectural guard. Biome's per-glob `overrides` mechanism is expressive enough for our 3–5 feature scale; the eslint-plugin's allowlist precision isn't needed because architectural detours (e.g. `lib/permissions.ts` reading user data via `lib/auth.ts`) avoid cross-feature imports entirely.

---

## ADR-004 — Server actions only; no tRPC

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Server actions are the only server↔client wire. `features/<f>/server/actions.ts` exports `"use server"` functions. No tRPC, no REST API, no GraphQL. Server components read via `features/<f>/server/queries.ts` directly.

**Alternatives:** tRPC (rejected: extra runtime, overkill for form-heavy admin app, App Router integration has rough edges).

**Rationale:** Form-heavy CRUD app benefits from server actions' progressive-enhancement story. Type-sharing is automatic since both sides are TypeScript. The "perm middleware" benefit of tRPC is replaceable with a `withPermission()` HOF wrapper at ~15 lines. Pattern matches the WDS reference.

---

## ADR-005 — Separate `user_profile` table; do not extend Better Auth's `user`

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Better Auth's `user` table stays vanilla. Domain fields (`firstName`, `lastName`, `nickname`, `mobileNumber`, `role`, `status`, `invitedAt`, `verifiedAt`) live in a separate `user_profile` table 1:1-linked via FK with `onDelete: "cascade"`.

**Alternatives:** Extend BA's `user` directly via `additionalFields` (rejected: mixes auth and domain concerns; future BA migrations may conflict; auth-provider portability suffers).

**Rationale:** Concern separation. Auth provider can be swapped without touching domain data. Better Auth schema stability isn't our problem.

---

## ADR-006 — Zod output schemas are the UI type contract

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Server queries project columns explicitly and `.parse()` results through a Zod *output* schema in `features/<f>/schema.ts`. Drizzle table inference is the DB type only — never the UI type.

**Alternatives:** Drizzle inference all the way through (rejected: leaks DB-shaped fields and possible secrets — e.g. `account.password` — into UI); hand-rolled DTOs per feature (rejected: extra type source to keep in sync).

**Rationale:** Defense in depth against secret leakage; explicit home for computed fields (e.g. `displayName = nickname ?? firstName + " " + lastName`); decouples UI from DB schema changes. Runtime parse cost (~10–50 µs / 15 fields) is negligible at our scale.

---

## ADR-007 — Permission catalog: `as const` array, central in `lib/permissions.ts`

**Status:** accepted | **Date:** 2026-05-08

**Decision:** All permissions are listed as a single `as const` array in `apps/admin/src/lib/permissions.ts`. Type derived as `typeof PERMISSIONS[number]`. Comment-grouping by feature inside the file.

**Alternatives:** String-literal union (rejected: no runtime list); per-feature `permissions.ts` aggregated in lib (rejected: forces biome rule exception); TypeScript enum (rejected: legacy semantics).

**Rationale:** Single source of truth gives a security-audit focal point. `as const` array keeps type guarantees and adds runtime iteration (debug pages, startup self-checks, `z.enum(PERMISSIONS)` if needed). No biome-rule exception for `lib/` ↔ `features/` imports.

---

## ADR-008 — ADMIN gets all perms via `new Set(PERMISSIONS)`; SQUAD_MEMBER explicit whitelist

**Status:** accepted | **Date:** 2026-05-08

**Decision:** `ROLE_PERMISSIONS = { ADMIN: new Set(PERMISSIONS), SQUAD_MEMBER: new Set([...]) } satisfies Record<Role, ReadonlySet<Permission>>`. Module-load self-check asserts every declared perm is granted to ≥1 role.

**Alternatives:** Explicit ADMIN whitelist (rejected: duplication every time we add a perm); inverted `Record<Permission, Role[]>` (rejected: ADMIN repeats on nearly every line); generator function (rejected: less greppable).

**Rationale:** At 2 roles with one being "full access", implicit-all is correct. New perms automatically extend ADMIN, which matches the actual policy. Refactor path to explicit whitelist exists if a SUPERADMIN-style differentiation appears.

---

## ADR-009 — Server-side check API: P + A + W (predicate, assert, wrapper)

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Three helpers in `lib/permissions.ts`:
- `userHasPermission(perm) → Promise<boolean>` — for RSC conditional rendering.
- `assertPermission(perm) → Promise<void>` — throws; for inline guards.
- `withPermission(perm, action)` — HOF; the default for server actions, injects `userId`.

**Rationale:** Different call sites prefer different shapes. All three share the same internal `getCurrentUserRole()` + `roleHasPermission()` primitives — ~30 lines total. Removes auth+perm boilerplate from each action body.

---

## ADR-010 — Just `role` in session; perms computed from in-code map

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Session payload merges `firstName`, `lastName`, `nickname`, `role`, `status` (via Better Auth `additionalFields` + a session hook). Permissions are computed from `role` against the in-code `ROLE_PERMISSIONS` map on every check, both server (async) and client (`useHasPermission` hook reading `useSession()`).

**Alternatives:** Precompute and embed `permissions: Permission[]` in session (rejected: zero benefit; introduces stale-perm window when `ROLE_PERMISSIONS` changes in code).

**Rationale:** `Set.has()` is O(1); no perf gain from precompute. Code is the authority — perm changes take effect on next request without session refresh.

---

## ADR-011 — Client-side gates: server `<HasPermission>` + client `useHasPermission`

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Ship both:
- `<HasPermission perm="..." fallback={...}>...</HasPermission>` — async server component for RSC trees.
- `useHasPermission("...")` — client hook reading Better Auth's `useSession()` against the isomorphic `ROLE_PERMISSIONS` map.

Plus `assertPermission` at page-route tops for guarded pages.

**Rationale:** Each is the right tool for its layer (RSC vs client component). Skipping client hook would force every "disable button if no perm" UI into RSC; skipping the server component would ship perm-check JS for purely static gates.

---

## ADR-012 — Shared services: pattern A (direct imports + `vi.mock`), lazy provider construction

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Service modules in `lib/<service>.ts` export plain async functions. Tests mock via `vi.mock("@/lib/<service>")`, with `__mocks__/<service>.ts` siblings for shared default mocks. Providers (Resend client, etc.) are constructed inside the function — never at module load.

**Alternatives:** Class with singleton (rejected: idiomatic in OOP land, awkward in JS-FP); factory + DI (rejected: every server action threads services as params; awkward across RSC boundaries).

**Rationale:** Matches JS/Next convention. `vi.mock` is the standard testing pattern. Lazy provider construction makes mocking clean without module-level side effects. DI is the documented upgrade path if testing ergonomics ever become a real pain.

---

## ADR-013 — TypeScript strict-plus bundle + root `tsconfig.base.json`

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Add `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `verbatimModuleSyntax` on top of `strict`. Introduce `tsconfig.base.json` at repo root; per-package configs extend it. Bump `apps/homepage` `target` from `ES2017` to `ES2022`.

**Skipped:** `exactOptionalPropertyTypes` (high false-positive rate vs Drizzle / React conventions); `noImplicitOverride` (no classes); `noPropertyAccessFromIndexSignature` (marginal benefit).

**Rationale:** `noUncheckedIndexedAccess` catches the biggest real-bug class (assumed array elements). The other adds are costless safety. Bundle locks the per-package configs to a single source of truth.

---

## ADR-014 — UI: shadcn/ui + RHF + Zod + TanStack Table

**Status:** accepted | **Date:** 2026-05-08

**Decision:** shadcn/ui as the primitive library (components copied into `components/ui/` via the CLI). Add `@tanstack/react-table` and `date-fns` to dependencies. Already installed: react-hook-form, @hookform/resolvers, lucide-react, sonner, radix primitives, CVA, clsx, tailwind-merge, tw-animate-css.

**Alternatives:** Mantine / Park UI / Chakra (rejected: would clash with brand-tinted CSS variables); Tremor (rejected: overlap with shadcn, no analytics needs); hand-roll on raw Radix (rejected: shadcn is the cheaper path with the same primitives).

**Rationale:** Already-installed deps signal shadcn was the de facto choice. CSS variables in `globals.css` are pre-aligned to shadcn's expected names. Components are owned (copied, not packaged) so we can modify freely.

---

## ADR-015 — `lib/` over `services/` for cross-cutting infra

**Status:** accepted | **Date:** 2026-05-08

**Decision:** Cross-cutting non-React code (auth, db, email, env, permissions, future audit/sms/whatsapp/notify) lives in `apps/admin/src/lib/`. No separate `services/` folder.

**Alternatives:** Split into `lib/` (utilities) + `services/` (side-effecting clients) (rejected: fuzzy boundary; new naming convention to maintain; no precedent in shadcn / Next.js / WDS templates).

**Rationale:** `lib/` is the JS/Next.js convention. Single bucket keeps the "where does this go?" rule unambiguous.

---

## ADR-016 — Admin adopts shadcn new-york + theme-neutral wholesale; no token-level brand customization

**Status:** accepted | **Date:** 2026-05-09

**Context.** Pre-iter-16h the admin used hand-rolled hex tokens with a Bordeaux primary (`#b5564f`). Primitives like `--popover`, `--accent`, and `--destructive-foreground` were undeclared, causing visual gaps whenever shadcn components expected them. Multiple iterations (16c/d/e/g) cleaned the existing UI; the visual lift was explicitly deferred to iter-16h.

**Decision.** iter-16h vendors `@shadcn/theme-neutral` wholesale (`npx shadcn@latest add @shadcn/theme-neutral -c apps/admin --overwrite`). No Bordeaux override block. Admin goes fully neutral. Brand identity stays on the customer-facing homepage independently.

**Alternatives considered:**
- Apply Bordeaux override on top of `@shadcn/theme-neutral` in the same iteration (rejected: the neutral baseline hadn't been validated under light + dark + system; adding brand colour on top of an unvalidated baseline risks regressions in the full semantic token set).
- Keep the hand-rolled hex palette (rejected: undeclared tokens kept surfacing visual gaps as more shadcn primitives were adopted).

**Consequences.** Every iteration after this tracks `@shadcn/theme-neutral` upstream rather than maintaining a parallel design system. shadcn screenshots, examples, and blocks render as-shipped — no surprise divergence. Loss: admin no longer carries the Bordeaux brand. Mitigation: **iter-16i** (planned) re-applies Bordeaux as a five-line override on `--primary` and derivatives if the brand-loss proves to matter — easy to add, easy to revert. See `design-system.md §1` for the exact override surface.

---

## How to add an ADR

When making a new architectural decision:

1. Add the next ADR-N entry to this file.
2. Update / create the relevant detailed doc (`folder-structure.md`, etc.) to reflect the decision.
3. If the new ADR supersedes an old one, mark the old `status: superseded` and add a "Superseded by ADR-N" line.

Don't delete superseded entries — historical context matters.
