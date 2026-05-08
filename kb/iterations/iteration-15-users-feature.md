---
title: Iteration 15 — Users feature (invite, list, delete, message)
type: iteration
order: 16
status: implemented
---

# Iteration 15 — Users feature

The first real feature on top of the iter-14 foundation. Admins can invite users, see the list, delete users, and send a one-off message to a user. Everything gated by the perm helpers from iter-14. UI built with shadcn primitives.

## Pre-flight

- [x] iter-14 is merged. `lib/permissions.ts` exists, `user_profile` migrated.
- [x] Apply the iter-14 `user_profile` migration to **prod** if it didn't auto-apply on the iter-14 deploy. Verify with a one-off query.
- [x] Backfill a `user_profile` row for the seeded admin user — the existing user has no profile row yet. One-time seed script update.

## Scope — feature scaffold [4/4]

- [x] Create `apps/admin/src/features/users/` with the layout from [folder-structure.md](../admin-architecture/folder-structure.md):
  - `schema.ts` (Zod input + output schemas)
  - `server/queries.ts`
  - `server/actions.ts` (`"use server"`)
  - `components/` (forms, tables, dialogs)
- [x] Add the per-feature Biome override to `biome.json` forbidding `@/features/events/**` and `@/features/services/**` (events/services don't exist yet but the rule is forward-looking).
- [x] Add a route at `apps/admin/src/app/(dashboard)/users/page.tsx`. Page is thin: `await assertPermission("USER_INVITE")` at top, then composes `<UsersTable />` and `<InviteUserButton />` from feature components.
- [x] Add the dashboard sidebar (`components/DashboardSidebar.tsx`) with a "Users" link gated by `<HasPermission perm="USER_INVITE">`.

## Scope — schemas [2/2]

- [x] `features/users/schema.ts` — Zod schemas:
  - `inviteUserInput` — email, firstName, lastName, mobileNumber (optional), nickname (optional), role.
  - `userListItem` — output shape for list views (id, email, displayName, role, status, createdAt).
  - `userDetail` — output shape for the per-user detail/edit screen if added.
- [x] Add unit tests for the schemas: invalid emails rejected; required fields enforced; role enum constrained.

## Scope — invite flow [5/5]

- [x] `inviteUser` server action (in `server/actions.ts`):
  - Wrapped via `withPermission("USER_INVITE", ...)`.
  - Generates a random temporary password (`crypto.randomBytes(32).toString("base64url")`).
  - In a transaction: `auth.api.signUpEmail({ email, password, name })` where `name = nickname?.trim() || \`${firstName} ${lastName}\`.trim()` (Better Auth's `user.name` is a single column), then insert `user_profile` with `firstName`, `lastName`, `nickname`, `mobileNumber`, `role`, `status: "invited"`, `invitedAt: now`. Pass *only* `{ email, password, name }` to `signUpEmail`: iter-14 stores domain fields on `user_profile`, not on the auth `user` table (`additionalFields` in `lib/auth.ts` exist for session typing only; the `databaseHooks.session.create.before` hook injects the values from `user_profile`).
  - Triggers Better Auth's password-reset / email-verification flow. Email body includes a "Set your password" link pointing at a route handler that validates the token and accepts a new password.
  - Returns `{ error: false, message: "Invitation sent." }` or surfaces the parse / DB error.
- [x] `<InviteUserDialog>` client component:
  - shadcn `<Dialog>` triggered by an `<InviteUserButton>` placed in the page.
  - Form via the canonical RHF + zodResolver + `<Form>` shadcn pattern (see [ui-stack.md](../admin-architecture/ui-stack.md)).
  - On success: `toast.success`, close dialog, `router.refresh()` to reload the list.
- [x] Decide and document the "set password" landing route. **Implemented as option (1):** Better Auth's `requestPasswordReset` flow drives the invite email; the link points at `/set-password?token=…` (a client page that calls `authClient.resetPassword`). Middleware excludes `/set-password` from the auth gate.
- [x] On the seeded admin's first sign-in (or first iter-15 deploy), backfill `user_profile` for the existing seeded user with `role: "ADMIN"`, `status: "verified"`, `verifiedAt: now`. Idempotent. **Implemented in `apps/admin/scripts/seed-admin.ts`.**
- [x] When the user clicks the email link and successfully sets a password, flip `user_profile.status: "verified"` and set `verifiedAt`. **Implemented in `databaseHooks.session.create.before` in `lib/auth.ts`:** the first session created after the password-reset flow flips the row. Failure to write is logged and non-fatal — sign-in proceeds, the next session retries.

## Scope — list + delete [3/3]

- [x] `listUsers` query in `server/queries.ts`:
  - JOIN `user` ↔ `user_profile`.
  - Project columns explicitly. Map to `userListItem` output schema. `.parse()` at the boundary.
  - Returns sorted by `createdAt DESC`.
- [x] `<UsersTable>` component using TanStack Table + shadcn data-table recipe. Columns: Display Name, Email, Role (badge), Status (badge: invited / verified), Created, Actions menu.
- [x] `deleteUser` server action:
  - Wrapped via `withPermission("USER_DELETE", ...)`.
  - Refuses to delete self (compares `userId` arg to the wrapped `userId`).
  - **Implementation note:** deletes directly from the `user` table via Drizzle (`db.delete(user)…returning(...)`). The FK cascade on `user_profile.user_id` removes the profile row. We don't call `auth.api.deleteUser({ id })` because Better Auth's helper expects an authenticated user-context (it's designed for self-deletion); admin-driven deletion goes through the perm-checked server action instead. Returns `{ error: true, message: "User not found." }` if 0 rows are affected.
  - Confirmation dialog (`<DeleteUserConfirm>`) on the client.

## Scope — admin → user message [2/2]

- [x] `messageUser` server action:
  - Wrapped via `withPermission("USER_MESSAGE", ...)`.
  - Input: `{ userId, subject, body }` (Zod schema).
  - Looks up user by id, calls `sendEmail({...})` from `lib/email`. `sendEmail` failure is caught and surfaced as `{ error: true, message }`.
  - Returns `{ error: false, message: "Message sent." }`.
- [x] `<MessageUserDialog>` — shadcn `<Dialog>` with subject + body (textarea), triggered from the user-row actions menu.

## Scope — verify [3/3]

- [x] `npm run verify` green; perm tests still pass; new schema/action/query tests pass.
- [x] Manual: as admin, invite a user. Receive the dev-console-printed email. Click the link, set a password, sign in as the invited user. Confirm `status: verified` flipped.
- [x] Manual: as admin, message the seeded admin. Confirm dev-email shows up. Delete a non-self user. Refuse self-deletion test.

## Out of scope (deliberate)

- **Audit log of admin actions** — defer until iter-15 actually surfaces a need (or land it as a small follow-up after iter-15).
- **MFA enforcement on admin invite** — iter-19.
- **Roles editable post-invite** — could add later. Today: role chosen at invite, immutable.
- **Bulk invite** — single-user invites only.
- **User search / filter / pagination** — TanStack Table can do them, but skip until row count > 50.
- **SMS / WhatsApp message-user** — future; iter-15 only sends email.

## Critical files

New:
- `apps/admin/src/features/users/schema.ts`
- `apps/admin/src/features/users/server/queries.ts`
- `apps/admin/src/features/users/server/actions.ts`
- `apps/admin/src/features/users/components/UsersTable.tsx`
- `apps/admin/src/features/users/components/InviteUserDialog.tsx`
- `apps/admin/src/features/users/components/InviteUserForm.tsx`
- `apps/admin/src/features/users/components/MessageUserDialog.tsx`
- `apps/admin/src/features/users/components/UserActionsMenu.tsx`
- `apps/admin/src/app/(dashboard)/users/page.tsx`
- `apps/admin/src/components/DashboardSidebar.tsx`

Edited:
- `biome.json` (per-feature override)
- `apps/admin/scripts/seed-admin.ts` (also insert `user_profile` row)

## Risks / things that could bite

- **The "set password" landing flow.** Better Auth's email-verification + reset-password flow is the recommended path but requires tying our invite to it. Edge cases: token expiry, link reuse, mismatched email. Test thoroughly.
- **The seeded admin has no `user_profile`.** First iter-15 deploy must backfill — the alternative is a sign-in that succeeds via Better Auth but fails our new `getCurrentUserRole()` (returns `null` → no perms → empty dashboard). Pre-flight item above handles this.
- **Better Auth hook signature for "password set."** The hook to flip `status: "verified"` lives in BA's lifecycle; need to find the right hook (`user.update` or `account.passwordReset` or similar). Plan a 30-min spike during impl.

## Done when

- [x] Admin can invite a new user, who receives a (dev-console or real Resend) email with a "Set your password" link.
- [x] User clicks the link, sets a password, signs in. Their status flips from `invited` → `verified`.
- [x] Admin can list, message, and delete users (not themselves).
- [x] All actions are perm-gated; SQUAD_MEMBER cannot reach the users page (404 / forbidden).
- [x] Tests cover: schema validation, perm enforcement, the "no self-delete" guard.
- [x] `npm run verify` green.
