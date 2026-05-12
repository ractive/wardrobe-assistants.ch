---
title: Admin app architecture overview
type: architecture
status: current
---

# Admin app architecture overview

**Read this any time you're working in `apps/admin/` or `packages/db/`.** It's the contract for how the admin app is structured. The detailed docs link below dive deeper per topic. The [decision log](decision-log.md) records *why* each major rule exists.

## One-paragraph summary

Feature-folder layout in `apps/admin/src/features/<f>/` (Zod input schemas, server queries, server actions, components — flat by default, plurals when files grow). Drizzle schemas split per feature in `packages/db/src/schema/<f>.ts`, aggregated in `packages/db/src/schema.ts`. Cross-feature imports are forbidden (Biome `noRestrictedImports` per-feature overrides). Server actions are the only server↔client wire — no tRPC. Permissions are a central `as const` array in `lib/permissions.ts` with hardcoded role→perm grants; everything checks permissions, never roles. Better Auth owns the `user` table; we own a separate `user_profile` 1:1. shadcn/ui + react-hook-form + Zod for UI; Resend for email; libSQL via Drizzle for data.

## The rules at a glance

| Rule | One-line |
|---|---|
| Folder | `apps/admin/src/features/<f>/{schema.ts, server/, components/}` ; cross-cutting in `lib/` ; primitives in `components/ui/` |
| Schema | Drizzle in `packages/db/src/schema/<f>.ts` ; aggregator at `packages/db/src/schema.ts` |
| Cross-feature | Forbidden by Biome. Promote to `lib/`, `components/`, `hooks/` to share. |
| Wire | Server actions only. Form posts via RHF + zodResolver → action.parse(input) → DB. |
| Type contract | DB tables → Drizzle inference. Form inputs → Zod (`features/<f>/schema.ts`). UI outputs → Zod schemas, queries `.parse()` at the boundary. |
| Identity | Better Auth's `user` untouched. `user_profile` 1:1 with `firstName`, `lastName`, `nickname`, `mobileNumber`, `role`, `status`. Cascade delete. |
| Permissions | `lib/permissions.ts` defines `PERMISSIONS` (`as const` array) and `ROLE_PERMISSIONS` map. ADMIN gets `new Set(PERMISSIONS)`; SQUAD_MEMBER explicit. Module-load self-check enforces every perm is granted. |
| Permission API | `userHasPermission(perm)`, `assertPermission(perm)`, `withPermission(perm, action)` — wrapped server actions get auth+perm check + `userId` injected. |
| UI gates | `<HasPermission perm="...">` (RSC) and `useHasPermission("...")` (client). |
| Session | Better Auth's session/user untouched. Role + status are read from `user_profile` at permission-check time via `roleForUserId(userId)` (called by `withPermission` / `getCurrentUserRole`). Perms computed on both sides from the in-code map (isomorphic). _(iter-15c — earlier "merge into session via additionalFields" was a no-op because session/user tables had no role column.)_ |
| Services | Direct imports. Lazy provider construction. Tests use `vi.mock` with `__mocks__/<service>.ts` siblings. |
| Notifications | `lib/notify.ts` dispatches both email and push on every call (`Promise.allSettled`). `lib/push.ts` handles VAPID/web-push with stale-sub cleanup. Neither channel blocks the other. |
| TypeScript | `strict` + `noUncheckedIndexedAccess` + `noFallthroughCasesInSwitch` + `noImplicitReturns` + `verbatimModuleSyntax`. One root `tsconfig.base.json`. |
| UI | shadcn/ui + RHF + Zod + TanStack Table + lucide + sonner. Tailwind v4 with shadcn-shaped CSS variables already wired to the brand. |

## Detailed docs

| Topic | Doc |
|---|---|
| **New feature?** Start here | [`feature-slice-template.md`](feature-slice-template.md) — concrete checklist for iter-16/17/18 |
| **Building UI?** Read first | [`design-system/README.md`](design-system/README.md) — wiki hub; sub-pages listed below |
| Folder structure, isolation rules | [`folder-structure.md`](folder-structure.md) |
| Drizzle schemas, type contracts, identity model | [`data-layer.md`](data-layer.md) |
| Server actions, queries, services, mocking | [`server-layer.md`](server-layer.md) |
| Better Auth, RBAC, session shape, gates | [`auth-and-permissions.md`](auth-and-permissions.md) |
| shadcn/ui, forms, tables, icons, conventions | [`ui-stack.md`](ui-stack.md) — library inventory; design-system rules in [`design-system/`](design-system/README.md) |
| TypeScript strictness, tsconfig.base.json | [`typescript-conventions.md`](typescript-conventions.md) |

### Design-system sub-pages

Per-topic pages under [`design-system/`](design-system/README.md) — read the one you need, not the whole set:

| Topic | Page |
|---|---|
| Bordeaux brand tokens, theme management, hex bridge | [`design-system/tokens.md`](design-system/tokens.md) |
| Breakpoints + 375px mobile-first cascade | [`design-system/breakpoints.md`](design-system/breakpoints.md) |
| Spacing scale (page/section/card/inline) | [`design-system/spacing.md`](design-system/spacing.md) |
| Typography roles (h1/h2/body/caption) | [`design-system/typography.md`](design-system/typography.md) |
| Layout primitives (`<PageHeader>`, `<Empty>`) | [`design-system/layout-primitives.md`](design-system/layout-primitives.md) |
| Forms — `<Form>` + RHF + Zod shape | [`design-system/forms.md`](design-system/forms.md) |
| Tables — cards on mobile, table on desktop | [`design-system/tables.md`](design-system/tables.md) |
| Dialogs vs sheets on mobile | [`design-system/dialogs-and-sheets.md`](design-system/dialogs-and-sheets.md) |
| Shared `<StatusBadge>` variant maps | [`design-system/status-badges.md`](design-system/status-badges.md) |
| Icons — `lucide-react`, `aria-hidden` | [`design-system/icons.md`](design-system/icons.md) |
| `<HasPermission>` server vs client gating | [`design-system/permission-gating-ui.md`](design-system/permission-gating-ui.md) |
| A11y baseline + `vitest-axe` smokes | [`design-system/a11y.md`](design-system/a11y.md) |
| `motion-safe:` + default transition | [`design-system/animation.md`](design-system/animation.md) |
| Anti-patterns checklist | [`design-system/anti-patterns.md`](design-system/anti-patterns.md) |
| Vendored shadcn blocks | [`design-system/blocks.md`](design-system/blocks.md) |
| Theme switcher (light/dark/system, CSP nonce) | [`design-system/theme.md`](design-system/theme.md) |

## Decision log

The [decision log](decision-log.md) records the *why* behind each architectural rule. When a rule feels arbitrary or you're tempted to break it, read the relevant ADR first — chances are the rationale still applies.

## Iteration sequence

This architecture lands across iter-14 (foundation) and is exercised by iter-15..iter-18 (one feature per iteration). Subsequent iterations (auth/MFA, email senders, SMS/WhatsApp, deeper invoice flow) layer on top. See `kb/iterations/iteration-14-foundation.md` and following.

## When to update this doc

Update **only** when an architectural decision changes (a new ADR is accepted with status `superseded` on the old one). Day-to-day code changes, bug fixes, and feature work do **not** belong here. The detailed docs follow the same rule — they're the contract, not the work log.
