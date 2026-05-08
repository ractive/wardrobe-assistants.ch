---
title: Data layer — Drizzle, type contracts, identity model
type: architecture
status: current
---

# Data layer — Drizzle, type contracts, identity model

## Drizzle schema split

Schema files live in `packages/db/src/schema/<f>.ts`, one per feature. The aggregator at `packages/db/src/schema.ts` re-exports them:

```ts
// packages/db/src/schema.ts
export * from "./schema/auth"      // Better Auth tables
export * from "./schema/users"     // user_profile (1:1 with auth.user)
export * from "./schema/events"    // events feature
export * from "./schema/services"  // services feature
```

Drizzle-kit reads `packages/db/src/schema.ts` per `drizzle.config.ts` and sees the full picture. Adding a feature = new file under `schema/`, plus one line in the aggregator.

## Type contracts: where types come from

Three layers carry types:

| Layer | Source | Example |
|---|---|---|
| **DB row shape** | Drizzle `$inferSelect` / `$inferInsert` | `typeof eventsTable.$inferSelect` |
| **Form input** | Zod schemas in `features/<f>/schema.ts` | `z.infer<typeof inviteUserInput>` |
| **UI output** | Zod *output* schemas in same `schema.ts` | `z.infer<typeof userListItem>` |

### Per feature: `schema.ts` exports BOTH input and output

```ts
// features/users/schema.ts
import { z } from "zod"

// INPUT — what forms post (also used by action.parse(unsafe))
export const inviteUserInput = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mobileNumber: z.string().optional(),
  nickname: z.string().optional(),
  role: z.enum(["ADMIN", "SQUAD_MEMBER"]),
})
export type InviteUserInput = z.infer<typeof inviteUserInput>

// OUTPUT — what UI sees
export const userListItem = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),                  // computed
  role: z.enum(["ADMIN", "SQUAD_MEMBER"]),
  status: z.enum(["invited", "verified"]),
  createdAt: z.date(),
})
export type UserListItem = z.infer<typeof userListItem>
```

### Why output Zod schemas (defense in depth)

1. **Hashed passwords / secrets.** Better Auth's `account.password` column. If a query joins `user` ↔ `account` and we trust Drizzle inference, the hash leaks into the UI type. Output schema strips fields it doesn't know about.
2. **Computed fields.** `displayName = nickname ?? firstName + " " + lastName` — there's no DB column for this. Output schema is the natural home.
3. **Decoupled UI from DB.** Renaming `events.notes` → `events.description` for DB reasons doesn't break UI components — the output schema can map.
4. **Refactor safety.** Adding an internal column doesn't silently flow to UI.

### Cost is real but small

`schema.parse()` on a 15-field object is ~10–50 µs. List of 100 events ≈ 5 ms total — invisible at our scale. Bundle cost: zero (Zod already loaded for input validation).

### Pattern in queries

```ts
// features/users/server/queries.ts
export async function listUsers(): Promise<UserListItem[]> {
  const rows = await db
    .select({
      id: user.id, email: user.email,
      firstName: userProfile.firstName, lastName: userProfile.lastName,
      nickname: userProfile.nickname, role: userProfile.role,
      emailVerified: user.emailVerified, createdAt: user.createdAt,
    })
    .from(user)
    .innerJoin(userProfile, eq(user.id, userProfile.userId))

  return rows.map(r => userListItem.parse({   // ← runtime defense
    ...r,
    displayName: r.nickname ?? `${r.firstName} ${r.lastName}`,
    status: r.emailVerified ? "verified" : "invited",
  }))
}
```

The `.parse()` call is the safety net. Drop it (or use `.safeParse()` and handle errors) only in measured hot paths.

## Identity model — `user_profile` 1:1 with Better Auth's `user`

Better Auth's `user` table stays vanilla. Domain fields live in our own `user_profile`:

```ts
// packages/db/src/schema/users.ts
export const userProfile = sqliteTable("user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  nickname: text("nickname"),
  mobileNumber: text("mobile_number"),
  role: text("role", { enum: ["ADMIN", "SQUAD_MEMBER"] }).notNull(),
  status: text("status", { enum: ["invited", "verified"] }).notNull().default("invited"),
  invitedAt: integer("invited_at", { mode: "timestamp_ms" }).notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
})
```

### Why separate (vs extending Better Auth's `user`)

1. **Better Auth schema stability.** Their `user` table is theirs. Adding columns there fights potential future BA migrations.
2. **Auth-provider portability.** Domain data isn't trapped in an auth-specific table.
3. **Concern separation.** Auth = email, password hash, sessions, MFA secrets. Domain = first/last/nickname/mobile/role/status.
4. **Better Auth's `name` field is awkward.** A single string. We set it to a synthesized `displayName` at create time and ignore it elsewhere.

### Lifecycle

- **Invite** (admin invites a new user):
  1. Server action receives `inviteUserInput`.
  2. Transaction:
     - `auth.api.signUpEmail({ email, password: <random>, name: <derived> })` — creates `user` row.
     - Insert `user_profile` row with `userId = user.id`, `status="invited"`, `invitedAt=now`.
     - Trigger Better Auth's email-verification flow with a custom "set your password" template.
  3. When user clicks the link: BA sets `emailVerified=true`. We update `user_profile.status="verified"` + `verifiedAt=now` via a hook.
- **Cascade delete.** `onDelete: "cascade"` on the FK means deleting `user` removes `user_profile`. `auth.api.deleteUser()` triggers it.

### Roles live here, not in Better Auth's `user`

`role` is domain data, not auth data. The Better Auth session-customisation hook reads `user_profile.role` at session-create time and merges it into the session payload:

```ts
// lib/auth.ts (sketch)
session: {
  additionalFields: {
    firstName: { type: "string", required: false },
    lastName: { type: "string", required: false },
    role: { type: "string", required: false },
    status: { type: "string", required: false },
  },
}
// Plus a hook that pulls these from user_profile on session create.
```

After this hook, `session.user.role` is available everywhere. Permissions are computed from role on each check (see [auth-and-permissions.md](auth-and-permissions.md)).

## What's NOT in scope of the data layer doc

- **Migrations workflow** — covered in `kb/runbooks/iac-runbook.md` (prod) and `apps/admin/scripts/migrate.ts` (local).
- **Seed data** — covered by `apps/admin/scripts/seed-admin.ts` and `db-reset.ts` (planned in iter-13).
- **Connection lifecycle** — single client per process via `lib/db.ts` (existing).
