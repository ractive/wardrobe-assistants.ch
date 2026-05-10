---
title: Auth & permissions — Better Auth, RBAC, gates
type: architecture
status: current
---

# Auth & permissions — Better Auth, RBAC, gates

## Better Auth setup

Configured in `apps/admin/src/lib/auth.ts`. Uses the Drizzle adapter (SQLite/libSQL), the `twoFactor` plugin, and `nextCookies`. Session cookies are origin-scoped to `admin.wardrobe-assistants.ch` so an XSS on the public homepage can't reach them.

### Session payload — what's merged in

The session-customisation hook merges domain fields from `user_profile` into the session:

```ts
// lib/auth.ts (sketch — actual impl in iter-14)
session: {
  additionalFields: {
    firstName: { type: "string", required: false },
    lastName: { type: "string", required: false },
    nickname: { type: "string", required: false },
    role: { type: "string", required: false },
    status: { type: "string", required: false },
  },
}
// Plus: a hook that pulls these from user_profile by userId on session create.
```

After this hook runs, server code calls `auth.api.getSession()` and gets `{ user: { id, email, role, firstName, lastName, ... } }` — no separate query needed.

**Permissions are NOT in the session.** They're computed from `role` on every check (server) or from `useSession()` (client) against the in-code `ROLE_PERMISSIONS` map. Reasons:
- Computing from role is O(1) `Set.has()`.
- No staleness when `ROLE_PERMISSIONS` changes in code.
- Smaller session JSON.

## Permission catalog

Single source of truth: `apps/admin/src/lib/permissions.ts`.

```ts
export const ROLES = ["ADMIN", "SQUAD_MEMBER"] as const
export type Role = typeof ROLES[number]

export const PERMISSIONS = [
  // Users
  "USER_INVITE", "USER_DELETE", "USER_MESSAGE",
  // Bookings
  "BOOKING_VIEW", "BOOKING_CREATE", "BOOKING_DELETE", "BOOKING_ASSIGN",
  "BOOKING_INVOICE", "BOOKING_MESSAGE_ASSIGNED",
  // Squad-member surface
  "SQUAD_VIEW_ASSIGNED", "SQUAD_REQUEST_PARTICIPATION",
  "BOOKING_APPROVE_REQUEST",
] as const
export type Permission = typeof PERMISSIONS[number]

const ROLE_PERMISSIONS = {
  ADMIN: new Set<Permission>(PERMISSIONS),                    // all by construction
  SQUAD_MEMBER: new Set<Permission>([
    "SQUAD_VIEW_ASSIGNED",
    "SQUAD_REQUEST_PARTICIPATION",
  ]),
} satisfies Record<Role, ReadonlySet<Permission>>

// Module-load self-check: every declared perm must be granted to ≥1 role
for (const p of PERMISSIONS) {
  const granted = Object.values(ROLE_PERMISSIONS).some(s => s.has(p))
  if (!granted) throw new Error(`Permission ${p} declared but not granted to any role`)
}
```

Adding a permission = add one string to `PERMISSIONS`. ADMIN gets it automatically. SQUAD_MEMBER's whitelist must be edited explicitly if they should also have it — the module-load check catches "declared but not granted" only when ZERO roles have it (since ADMIN gets all).

### When to add a SUPERADMIN-style role distinction

Today: 2 roles, ADMIN-gets-all is fine. If we ever introduce a "DELETE_ALL_DATA" perm that should NOT be in ADMIN, refactor `ROLE_PERMISSIONS.ADMIN` from `new Set(PERMISSIONS)` to an explicit whitelist. The `satisfies Record<Role, ReadonlySet<Permission>>` constraint stays identical, no call-site changes.

## Server-side check API

Three helpers in `lib/permissions.ts`:

### Predicate — `userHasPermission`

```ts
export async function userHasPermission(perm: Permission): Promise<boolean>
```

Returns `false` on no-session, no-role, or perm-missing. Used in server components for conditional rendering.

```tsx
// app/(dashboard)/users/page.tsx
const canInvite = await userHasPermission("USER_INVITE")
return <UsersTable showInviteButton={canInvite} />
```

### Assert — `assertPermission`

```ts
export async function assertPermission(perm: Permission): Promise<void>  // throws PermissionError
```

Used at the top of route components or in ad-hoc inline guards. Throws bubble to `error.tsx`.

```tsx
export default async function UsersPage() {
  await assertPermission("USER_INVITE")  // throws → error boundary → middleware redirect
  // ...
}
```

### Wrapper — `withPermission`

```ts
export function withPermission<TArgs extends unknown[], TResult>(
  perm: Permission,
  action: (userId: string, ...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult>
```

The default for server actions. Removes auth+perm boilerplate from each action body and injects the verified `userId`.

```ts
export const inviteUser = withPermission("USER_INVITE", async (userId, unsafe: InviteUserInput) => {
  const data = inviteUserInput.parse(unsafe)
  // userId is guaranteed authenticated + has USER_INVITE
  ...
})
```

### Internal: how the checks work

```ts
async function getCurrentUserRole(): Promise<Role | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return (session?.user as { role?: Role } | undefined)?.role ?? null
}

function roleHasPermission(role: Role | null, perm: Permission): boolean {
  return role !== null && ROLE_PERMISSIONS[role].has(perm)
}
```

`getCurrentUserRole()` lives in `lib/auth.ts` (or `lib/permissions.ts` — both `lib/`). This is the architectural exit from "lib/permissions.ts needs feature data" — the role lookup goes through Better Auth's session, not through `features/users/server/queries.ts`.

## Client-side gates

### Server-component `<HasPermission>`

```tsx
// components/HasPermission.tsx — async server component
export async function HasPermission({
  perm, fallback = null, children,
}: { perm: Permission; fallback?: React.ReactNode; children: React.ReactNode }) {
  return (await userHasPermission(perm)) ? children : fallback
}

// usage
<HasPermission perm="USER_INVITE" fallback={<NoPermissionCard />}>
  <InviteUserButton />
</HasPermission>
```

Use this for declarative RSC trees. No JS shipped to client when child doesn't render.

### Client `useHasPermission` hook

```tsx
// hooks/use-has-permission.ts
"use client"
import { authClient } from "@/lib/auth-client"
import { ROLE_PERMISSIONS, type Permission } from "@/lib/permissions"

export function useHasPermission(perm: Permission): boolean {
  const { data: session } = authClient.useSession()
  const role = session?.user?.role as keyof typeof ROLE_PERMISSIONS | undefined
  return role !== undefined && ROLE_PERMISSIONS[role].has(perm)
}
```

Use inside client components — buttons or fields conditionally rendered based on perm. Reads the same in-code `ROLE_PERMISSIONS` map (isomorphic).

### Page-top guard pattern

Prefer `assertPermission` at the top of a route component over middleware-based redirect. Middleware redirects are reserved for the unauthenticated case (already in `middleware.ts`). Permission checks belong with the route.

## Query-level authorization (iter-16f)

Sensitive `listX` / `getById` functions in
`features/{users,events}/server/queries.ts` call `assertPermission()` at
their entry. The route + page already gate, but the query is now also a
security boundary on its own — a future caller (RPC, fresh page,
helper script) is safe by default.

The smoke harness (`features/*/server/*.smoke.test.ts` and
`src/test/security.smoke.test.ts`) asserts that calling these queries
without the right perm throws `UnauthenticatedError` /
`PermissionError`.

## Email verification: why it's off

`emailAndPassword.requireEmailVerification: false` in
`apps/admin/src/lib/auth.ts`. This is deliberate.

The invite flow is: admin creates the user via `auth.api.signUpEmail`
(no client interaction), then triggers `requestPasswordReset`. The user
clicks the link in their email, lands on `/set-password?token=…`, and
sets a password. Possession of the email is *already* proven by the
ability to redeem the reset token — adding a separate verification flow
would re-prove the same fact.

Flipping `requireEmailVerification` to `true` without redesigning
invite-token expiry semantics (single-use vs. expiry-extended on
verification, etc.) would break the invite path. See iter-16f scope
notes for the deferred redesign.

## Rate limiting (iter-16f)

In-memory sliding-window limiter in `apps/admin/src/lib/rate-limit.ts`.
Applied at the Better Auth route handler boundary
(`app/api/auth/[...all]/route.ts`) for login (5/15min per IP+email),
password reset (3/hour per email), and signup (3/hour per IP). The
invite server action has its own bucket (10/hour per admin).

Single-container deploy makes process-local state acceptable. Restarts
wipe counters — a brief fail-open after deploy is preferable to a hard
dependency on Redis. Future swap to Upstash/Redis is mechanical: replace
the `Map` backend without changing the public `consume()` API.

## Audit log (iter-16f)

Append-only `audit_log` table (schema:
`packages/db/src/schema/audit_log.ts`). Every mutating server action
emits one row via `recordAudit()` from
`apps/admin/src/lib/audit-log.ts`. The row's ULID also surfaces as a
correlation ID in user-facing toasts on error paths and in server-side
logs — support can grep one ID across both.

## MFA

`twoFactor` plugin is enabled. Issuer: `"Wardrobe Assistants Admin"`. **MFA enforcement for admins is deferred** — to be designed in a later auth iteration along with user/password handling and dev-friendly bootstrapping.

For now: TOTP enrolment is voluntary on first sign-in if the user opts in. No role-based requirement.

## What's deliberately NOT in scope

- **Per-resource scoping** (e.g. "BOOKING_DELETE_OWN" — can delete bookings you created, not others). Spec doesn't call for it. If we ever need it, model is `withResourcePermission(perm, predicate)`.
- **Multi-perm helpers** (`userHasAllPermissions`, `userHasAnyPermission`). Add when a real call site demands it.
- **Time-bound permissions** (e.g. "this user can do X until 2026-09-01"). Out of scope.
- **Dynamic role-perm assignment** (configurable in DB). Hardcoded role→perm is the explicit constraint.
