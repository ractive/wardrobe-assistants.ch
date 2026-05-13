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

**Consequences.** Every iteration after this tracks `@shadcn/theme-neutral` upstream rather than maintaining a parallel design system. shadcn screenshots, examples, and blocks render as-shipped — no surprise divergence. Loss: admin no longer carries the Bordeaux brand. Mitigation: **iter-16i** (planned) re-applies Bordeaux as a five-line override on `--primary` and derivatives if the brand-loss proves to matter — easy to add, easy to revert. See [`design-system/tokens.md`](design-system/tokens.md) for the exact override surface.

---

## ADR-017 — Cross-channel notifications: always fire both email and push

**Status:** accepted | **Date:** 2026-05-10

**Decision:** `lib/notify.ts` is the single notification entry point for all user-facing events. It always fires both email (Resend) and push (web-push/VAPID) for every supported template key, using `Promise.allSettled` so one channel's failure never blocks the other. Callers use one function (`notifyUser(userId, templateKey, params)`) and do not decide which channels to use.

**Supported template keys (iter-23, renamed in iter-24):** `bookingAssigned`, `bookingBroadcast`, `participationRequested`, `userDirectMessage`.

**Alternatives considered:**
- Caller chooses channels at each call site (rejected: every new call site must reason about channel selection; easy to forget push; harder to audit coverage).
- Push-only for some events (rejected: premature; email is the reliable fallback; keeping both always simplifies the mental model).
- A `channels` option param (rejected: same as caller-chooses; adds API surface with no near-term benefit).

**Rationale:** Dual-channel always simplifies call sites (one call, one audit log entry) and guarantees push reach for all notifiable events without opt-in per call site. `Promise.allSettled` ensures neither channel blocks delivery through the other. Per-channel failures are logged inside `lib/push.ts` / `lib/email.ts` without propagating unless both throw.

---

## ADR-018 — Service worker is push-only; no offline/fetch handler

**Status:** accepted | **Date:** 2026-05-10

**Decision:** `public/sw.js` contains only `push` and `notificationclick` event handlers. There is no `fetch` handler, no caching, and no offline support. This is permanent, not deferred.

**Alternatives considered:**
- Serwist / Workbox for offline-first (rejected: admin requires real-time data; stale cache is actively harmful for an ops tool; added complexity with no user benefit).
- Cache static assets only (rejected: even asset caching introduces CLS/update-delay risks; the app is behind auth so perceived load time isn't a public-facing concern).

**Rationale:** Push delivery is the only reason a service worker exists in this app. Offline is out of scope by product decision. A fetch handler that does nothing but pass through is still a foot-gun (opaque responses, update mechanics). Simpler SW = fewer failure modes.

---

## ADR-019 — Booking is a single entity with a status state machine (not event + booking_request)

**Status:** accepted | **Date:** 2026-05-11

**Decision:** One `bookings` table covers the full lifecycle from public request through completion. Status: `created | offered | accepted | rejected | cancelled`. `invoicedAt` is a parallel field, not a status. Customer-created and admin-created bookings traverse identical states, distinguished only by `createdBy` (nullable FK; null = customer-created via public form). See [iter-25](../iterations/done/iteration-25-booking-domain.md).

**Alternatives considered:**
- Separate `booking_request` + `event` tables (rejected: request and event can't exist without each other — textbook signal of one entity with a state machine, not two; doubles the schema and forces awkward joins for shared fields like date/venue/services).
- Status `accepted` + separate `scheduled` state (rejected: squad-assignment fullness is a property of `booking_assignments` rows, not the top-level booking; conflating them forces booking-state code to know about assignment counts).
- Status `completed` (rejected: no one transitions it manually; query `WHERE status='accepted' AND date < now()-1day` covers "needs invoicing" without a dedicated state).

**Rationale:** The lifecycle is genuinely linear with state-dependent permissions and emails. A single table with a status enum is the textbook fit. Admin-created bookings simply skip earlier states (start at `created`, optionally jump to `accepted` for offline-agreed work).

---

## ADR-020 — Booking line items: single snapshot, frozen at "send offer", versioned via counter + audit log

**Status:** accepted | **Date:** 2026-05-11

**Decision:** `booking_service_item` rows are created/replaced at every "send offer" admin action. Each row snapshots `name`, `description`, `priceType`, `unitPriceCents`, `quantity`, `hoursInMinutes`, `totalCents` (stored, computed at insert). `serviceId` is a nullable informational FK (`ON DELETE SET NULL`). Pre-offer service selections live in a separate mutable `booking_service_selection` table. `bookings.offerVersion` integer counter increments on every send/resend; previous snapshots are captured to `audit_log` for history. Revising an offer after acceptance is allowed: status moves `accepted → offered`, `acceptedAt` is cleared, customer must re-accept on the same UUID URL. Continues the iter-17/iter-22 line-item contract (Stripe + Shopify pattern).

**Alternatives considered:**
- Separate `offer_versions` table holding immutable per-version snapshots (rejected: heavier than needed; Stripe-quote-revision-style versioning is for high-touch B2B with many concurrent open versions; wardrobe bookings are 1:1 sequential).
- Pure value copy with no `serviceId` FK at all (rejected: nullable FK costs nothing and gives free analytics — "how many bookings used Service X this quarter").
- Versioned service catalog with `service_versions` rows pointed at by line items (rejected: over-engineered; pricing changes are infrequent; snapshot-on-write is the standard).
- Rotating `offerToken` on each revision (rejected: defeats bookmark stability; customers refer to the same URL across revisions).

**Rationale:** Audit-log history + single "current" snapshot keeps queries trivial (offer page shows `MAX(offerVersion)` rows) while preserving immutability of historical commitments. The Stripe + Shopify line-item contract is industry-canonical for this problem class; iter-17 already locked it for the invoicing side, iter-25 extends it to bookings.

---

## ADR-021 — Public POST endpoint exists in admin; CORS allowlist hardcoded, not env-var-driven

**Status:** accepted | **Date:** 2026-05-11

**Decision:** Customer-facing booking-request form on the homepage (`wardrobe-assistants.ch/booking-request`) browser-POSTs to `admin.wardrobe-assistants.ch/api/public/booking-requests`. The admin route lives outside the `(dashboard)` group so it bypasses auth. CORS `Access-Control-Allow-Origin` is matched against a hardcoded list (`https://wardrobe-assistants.ch`, `https://www.wardrobe-assistants.ch`, plus `http://localhost:*` when `NODE_ENV !== 'production'`). No env var. Spam defense stack: honeypot field + 2s minimum time-on-form + JS-injected token + rate limit (3/hr + 10/day per IP, 3/day per email). No Turnstile/captcha in v1. See [iter-26](../iterations/done/iteration-26-public-booking-request.md).

**Alternatives considered:**
- Form in admin app on a public route, homepage links there (rejected: subdomain crossover is acceptable but homepage form is preferred UX; fits the homepage's existing static-export deploy target).
- Bunny edge script writes directly to DB (rejected: would require sharing schema/validation/email/notification plumbing across two codebases or duplicating it; edge runtime ecosystem too thin for direct Postgres writes).
- Env-var-driven CORS allowlist (rejected: requires a Terraform/hoppy template change to deploy; the values are stable per environment and a code constant is simpler and harder to misconfigure).
- Turnstile from day one (rejected: adds a Cloudflare account dependency; honeypot + reinforcements is sufficient for the expected low traffic; upgrade path is small if abuse appears).

**Rationale:** Hardcoded allowlist removes an operational variable (no env to drift); the spam stack is layered and each-cheap. Form requires JS — accepted trade-off for a customer-facing booking form on a modern site.

---

## ADR-022 — Squad assignment confirmation is login-gated; no anonymous-token state changes

**Status:** accepted | **Date:** 2026-05-11

**Decision:** Assignment-invitation emails contain Confirm + Decline buttons linking to `admin.wardrobe-assistants.ch/my-bookings/<bookingId>?action=confirm|decline`. The URLs are **login-gated** via the standard Better Auth redirect flow; the action prompt is only rendered after authentication. Anonymous link visits do NOT change state. The customer-facing `/offer/<token>` page is unauthenticated (the customer has no account), but **all state-mutating endpoints** still require an explicit POST with a T&C checkbox — no GET side-effects anywhere. See [iter-29](../iterations/done/iteration-29-squad-assignment-confirmation.md).

**Alternatives considered:**
- UUID-token one-click confirm/decline endpoints (rejected: email clients pre-fetch and unfurl links — Outlook Safe Links, Slack/Teams previews, antivirus scanners. Any action triggered by GET fires automatically before the human clicks. Real-world data loss waiting to happen).
- Action prompt on page auto-submits based on `?action=` query param (rejected: same pre-fetch vulnerability translated one level).
- Email link to generic dashboard with no `?action=` hint (rejected: loses the affordance — the user clicked "Decline" in their inbox, the app should default the prompt accordingly even if the choice remains theirs to flip).

**Rationale:** The pre-fetching problem is real and pervasive in 2026 email ecosystems. Defense-in-depth: never put a state-mutating side effect behind a GET request, ever, even with an unguessable token. The `?action=` query param controls the default prompt UI but cannot itself trigger a state change without an authenticated POST.

---

## How to add an ADR

When making a new architectural decision:

1. Add the next ADR-N entry to this file.
2. Update / create the relevant detailed doc (`folder-structure.md`, etc.) to reflect the decision.
3. If the new ADR supersedes an old one, mark the old `status: superseded` and add a "Superseded by ADR-N" line.

Don't delete superseded entries — historical context matters.
