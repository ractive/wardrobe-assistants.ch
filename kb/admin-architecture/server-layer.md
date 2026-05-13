---
title: Server layer — actions, queries, services
type: architecture
status: current
---

# Server layer — actions, queries, services

## Server actions are the only wire

No tRPC. No REST API. Forms post via React Hook Form → server action; server components read via `server/queries.ts` directly. Type-sharing is automatic since both sides are TypeScript.

## File pattern per feature

```text
features/<f>/
  schema.ts                 # Zod input + output schemas
  server/
    queries.ts              # called from server components
    actions.ts              # "use server" mutations
  components/
```

### `server/queries.ts` — read-side

Plain async functions. Called from server components. Return type comes from the feature's output Zod schema (see [data-layer.md](data-layer.md)). The query may call `getCurrentUserId()` or `getCurrentUserRole()` from `lib/auth.ts` to scope by user.

```ts
// features/users/server/queries.ts
import { db } from "@/lib/db"
import { user } from "@wardrobe-assistants/db/schema"
import { userProfile } from "@wardrobe-assistants/db/schema/users"
import { eq } from "drizzle-orm"
import { userListItem, type UserListItem } from "../schema"

export async function listUsers(): Promise<UserListItem[]> {
  const rows = await db
    .select({...})
    .from(user)
    .innerJoin(userProfile, eq(user.id, userProfile.userId))
  return rows.map(r => userListItem.parse({...r, displayName: deriveDisplayName(r), status: deriveStatus(r) }))
}
```

**No caching wrappers.** WDS uses `dbCache(...)` with tag-based invalidation. We don't — at our scale, Next.js's built-in `revalidatePath`/`revalidateTag` is enough. Keep queries plain.

### `server/actions.ts` — write-side

Every mutation is a server action. Three things every action does, in order:

1. **Auth + perm** (via the `withPermission` wrapper).
2. **Validate** (`schema.parse(unsafe)`).
3. **Mutate** (DB call).
4. **Return** `{ error: false, message }` or `{ error: true, message }`.

Pattern:

```ts
// features/users/server/actions.ts
"use server"
import { withPermission } from "@/lib/permissions"
import { inviteUserInput } from "../schema"
import { sendEmail } from "@/lib/email"
import { db } from "@/lib/db"

export const inviteUser = withPermission("USER_INVITE", async (userId, unsafe) => {
  const data = inviteUserInput.parse(unsafe)
  // ...DB transaction creating user + user_profile...
  await sendEmail({ to: data.email, subject: "...", text: "..." })
  return { error: false, message: "Invitation sent." }
})
```

`withPermission`:
- Calls Better Auth's `getSession()`.
- Throws `UnauthenticatedError` if no session.
- Reads `session.user.role`, throws `PermissionError` if perm not granted.
- Injects the verified `userId` as the first arg to the action body.

See [auth-and-permissions.md](auth-and-permissions.md) for the full helper details.

### Action return shape (the contract)

```ts
type ActionResult = { error: false; message: string } | { error: true; message: string } | undefined
```

The form layer (RHF + sonner toast) handles errors:

```tsx
const onSubmit = form.handleSubmit(async (data) => {
  const result = await inviteUser(data)
  if (result?.error) toast.error(result.message)
  else if (result) toast.success(result.message)
  // (some actions redirect — they return undefined)
})
```

For redirect-on-success (e.g. after creating a row), the action calls `redirect()` from `next/navigation` and returns nothing.

### Validation parsing — `safeParse` vs `parse`

Use `.parse()` inside an action body. The `withPermission` wrapper already catches and rethrows; the form layer translates thrown errors to `{ error: true, ... }` via Next.js's serialisation. Less boilerplate than each action's manual `safeParse` + branching.

If you have a specific reason to short-circuit (e.g. preserve form state), use `safeParse`:

```ts
const parsed = inviteUserInput.safeParse(unsafe)
if (!parsed.success) return { error: true, message: parsed.error.issues[0].message }
```

## Shared services (email, audit, future SMS/WhatsApp)

Pattern A — direct imports of plain async functions. Tests mock via `vi.mock("@/lib/<service>")`.

### Service module shape

```ts
// lib/email.ts
import { Resend } from "resend"
import { env } from "./env"

export type SendEmailInput = { to: string; subject: string; text: string; html?: string }

export async function sendEmail(input: SendEmailInput): Promise<void> {
  // Dev fallback: print to stdout when RESEND_API_KEY is unset in development.
  if (env.resendApiKey === undefined && env.nodeEnv === "development") {
    console.log(`[dev email] to=${input.to} subject=${input.subject}`)
    return
  }
  // Lazy provider construction — never at module load (vi.mock-friendly).
  const resend = new Resend(env.resendApiKey!)
  const { error } = await resend.emails.send({ from: env.emailFrom, to: input.to, subject: input.subject, text: input.text, html: input.html ?? input.text })
  if (error) throw new Error(`Resend send failed: ${error.message}`)
}
```

**Conventions:**
1. **Lazy provider construction** — never `new Resend(...)` at module load. Inside the function only.
2. **Dev fallback inside the function** — branch on `env.nodeEnv === "development"` for console transport.
3. **Throw on failure** — server actions catch + return `{ error: true, ... }` at the boundary.

### Mocking in tests

Each service has a sibling `__mocks__/<service>.ts` for shared default mocks:

```text
apps/admin/src/lib/__mocks__/email.ts
```

```ts
// __mocks__/email.ts
import { vi } from "vitest"
export const sendEmail = vi.fn().mockResolvedValue(undefined)
```

Test files:

```ts
import { vi } from "vitest"
import { sendEmail } from "@/lib/email"

vi.mock("@/lib/email")  // auto-uses __mocks__/email.ts

beforeEach(() => {
  vi.mocked(sendEmail).mockClear()
  vi.mocked(sendEmail).mockResolvedValue(undefined)
})

it("sends an invite", async () => {
  await inviteUser({...})
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "..." }))
})
```

For **integration tests** that exercise our wrapper end-to-end, mock the SDK (`vi.mock("resend")`) one level deeper so our wrapper code runs against a fake Resend.

### What lives in `lib/` (vs in a feature)

- Multi-feature consumer → `lib/`. Email (used by users invite + events assigned), audit, future SMS/WhatsApp.
- Single-feature consumer → inside the feature folder. PDF generation if it's only ever for invoices → `features/events/server/invoice-pdf.ts`. Promote to `lib/pdf.ts` when a second feature needs it.

### Future services (planned)

| Service | File | When |
|---|---|---|
| `audit` — record auditable events | `lib/audit.ts` | iter-15 (users feature wants audit-of-invites) or later |
| `sms` — Twilio/Vonage/bunny | `lib/sms.ts` | TBD per iter-21 |
| `whatsapp` — WA Business API | `lib/whatsapp.ts` | TBD per iter-21 (evaluation) |
| `notify` — channel dispatcher | `lib/notify.ts` | only when "send via user's preferred channel" becomes a real requirement |

## Error types

Custom error classes in `lib/permissions.ts` (or `lib/errors.ts` if shared):

```ts
export class UnauthenticatedError extends Error { name = "UnauthenticatedError" }
export class PermissionError extends Error {
  constructor(public readonly perm: string) { super(`Missing permission: ${perm}`); this.name = "PermissionError" }
}
```

Why custom: server actions can `instanceof`-check to map to the right user-facing message:

```ts
try {
  return await action(...)
} catch (e) {
  if (e instanceof UnauthenticatedError) return { error: true, message: "Sign in required." }
  if (e instanceof PermissionError) return { error: true, message: "Forbidden." }
  throw e
}
```

(In practice this happens inside `withPermission`, so individual actions never write the boilerplate.)
