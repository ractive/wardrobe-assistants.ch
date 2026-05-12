---
title: Iteration 40 — Admin UI polish + observability
type: iteration
order: 41
status: planned
---

# Iteration 40 — Admin UI polish + observability

Ship the lower-priority items from `kb/Notes.md`: small UI affordance fixes on /bookings, /services, /users, the notifications-toggle copy, and a server-side log expansion. Plus two exploratory items (table-component abstraction, stored-notification bell badge) framed as "research first, decide whether to land in this iteration or queue iter-40b."

Implemented autonomously by `/ralph-loop` where possible; must leave the system fully working at the iteration boundary. All items are polish on existing flows — no domain rules, no permissions, no schema changes.

## Decisions

- **Three deliverable §s + two research §s.** §§A–C are concrete UI/copy/log changes. §§D–E are research items: write up findings (in this iteration's commit/PR description), then either land the change here or open iter-40b with an explicit plan.
- **Icons over kebab menus where there are ≤2 actions** (§B). For /users the kebab has Message + Delete (2 items) → swap to two icon buttons. For /services the kebab has Edit + Archive (2 items) → swap to two icon buttons. Keep the kebab as the fallback for rows with 3+ actions. Tooltip on hover, `aria-label` mandatory. Icons: `Mail` (Message), `Trash2` (Delete), `Archive` (Archive) — all from `lucide-react`.
- **"Needs completion" badge removal is straight rip-out** (§A.2). When iter-37 §C.3 made time/duration/city required at app-layer, the badge became orphan UI for legacy rows that no longer exist post-migration. Verify the migration cleaned up the row population, then delete the badge component and its usage sites.
- **Line-item amount alignment** (§A.4). Current: right-aligned numeric. New: left-aligned in both read-only and edit modes, with the numeric still right-padded for visual rhythm. The widescreen readability problem is genuine — the eye has to traverse the full row width to associate name ↔ amount.
- **Notification toggle copy** (§A.5). "Notifications on / Notifications off" is ambiguous (state or action?). Replace the text-button with a shadcn `<Switch>` paired with a label "Notifications". The label is constant; only the switch state changes. Accessible via keyboard (Tab + Space).
- **Server-side log expansion** (§C). One-line `console.log` (or pino if we wire it in) per auth event + booking action. **Don't introduce a logging framework this iteration** — `console.log` lands in stdout, bunny Magic Containers capture stdout, that's enough. If we later need structured logs (`hoppy logs` integration, log levels, request IDs), iter-41 picks it up. Format: `[evt=<name> userId=<id?> bookingId=<id?>] <free text>`. Keep PII out — log userIds, never emails.
- **Don't refactor for abstraction's sake** (§D). The table-component idea is sound *if* the three current tables share enough structure that abstracting them reduces code rather than papering it over. The §D entry is a research note, not a commitment.
- **`ff-rdp` dogfooding** report appended at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md`.

## Pre-flight

- [x] iter-39 merged on `main`.
- [x] `npm run verify` green on this iteration's branch base.
- [x] No in-flight branches touching `apps/admin/src/features/bookings/components/`, `apps/admin/src/features/services/components/`, `apps/admin/src/features/users/components/`, `apps/admin/src/components/UserMenu.tsx` (notifications toggle lives here), or `apps/admin/src/lib/auth.ts` (log additions).

## Scope

### A. Bookings detail / list polish (5 items)

`apps/admin/src/app/(dashboard)/bookings/[id]/page.tsx` + adjacent components.

1. **Move the `(i)` indicator inside the lifecycle action button.** Currently the `(i)` popover sits *next to* each action button (per iter-37 §A.6). Move the icon inside the button (right side, after the label), so the button itself is the trigger surface. Desktop: tooltip on hover *and* click; click is the mobile equivalent — both must work. Use shadcn `<Tooltip>` for hover + `<Popover>` for click, or pick a single component that handles both (Radix's `<HoverCard>` triggers on hover/focus but not click, so probably `<Tooltip>` with explicit `onClick` to also open it). Keyboard: Tab to button → tooltip shows on focus, Enter activates the button as before.

2. **Remove the "Needs completion" badge.** Grep `Needs completion` in `apps/admin/src/`. Verify the booking-detail page no longer needs it (the iter-37 schema changes made the fields required at app-layer; legacy rows should have been backfilled or, if any remain, surface the missing data inline rather than via a badge). Delete the badge component file if it has no other consumers; otherwise just delete the usage.

3. **Booking Edit form revisit.** Open the form that the **Edit** button on /bookings/<id> opens. Inspect; report what's specifically wrong (Notes.md just flags "the form that opens when editing" without a precise issue). Likely candidates from inspection: missing validation messages per field, layout shift on open, no autofocus on first field, missing keyboard close (Esc). Fix what's broken; document what was changed.

4. **Left-align line-item amounts.** `apps/admin/src/features/bookings/components/LineItemsTable.tsx` (or equivalent). Read-only and edit views both move the amount column from `text-right` to `text-left`. Add `tabular-nums` so the digits still line up. Keep a small right padding before the per-row action column so the amount doesn't crash into the kebab/delete button.

5. **Notifications toggle: text-button → switch.** `apps/admin/src/components/UserMenu.tsx` (or wherever the current `NotificationsToggle` lives — grep). Replace the text-button that toggles between "Notifications on" / "Notifications off" with a shadcn `<Switch>` paired with a static "Notifications" label. The switch's on/off state communicates clearly without doubling as action copy. Wire it to the existing `useWebPushSubscription` hook (or equivalent) — only the trigger surface changes, not the underlying subscribe/unsubscribe logic. Keyboard: Tab to switch, Space toggles. `aria-label="Notifications"` plus the `aria-checked` derived from the switch state.

### B. /users + /services row actions (2 items)

1. **/users: kebab → two icon buttons.** `apps/admin/src/features/users/components/UsersTable.tsx`. Replace the `DropdownMenu` in the actions column with two icon buttons: `<Mail aria-label="Message user">` opens the existing direct-message dialog; `<Trash2 aria-label="Delete user">` opens the existing delete confirmation. Same server actions, same permissions, same dialogs — only the trigger surface changes. Add `<Tooltip>` on each icon. Mobile: icons stay (already compact); ensure tap target ≥44×44px per design-system `a11y.md`.

2. **/services: kebab → two icon buttons.** Same shape: `<Pencil aria-label="Edit service">` and `<Archive aria-label="Archive service">`. Mirror the /users pattern. If there's a third action (e.g. "Duplicate"), keep the kebab — see Decisions §B's 3+ rule.

### C. Server-side log expansion (1 item)

Add `console.log` (or `console.error` for failures) calls at these surfaces — one line per event, no framework:

- **Auth.** `apps/admin/src/lib/auth.ts` `databaseHooks` or Better Auth's lifecycle hooks: successful sign-in (`[evt=auth.signin.ok userId=…]`), failed sign-in (`[evt=auth.signin.fail email=<hash-of-email?>]` — careful with PII, prefer omitting if no privacy-safe form). Successful sign-up, password-reset request, password-reset completion.
- **Bookings.** `apps/admin/src/features/bookings/server/actions.ts`: every server action (`createBooking`, `updateBooking`, `sendOffer`, `acceptOffer`, `rejectBooking`, `cancelBooking`, `deleteBooking`) emits one line on success — `[evt=booking.<action> userId=<actor> bookingId=<id>]`.
- **Services & users.** Same shape for `createService`, `archiveService`, `inviteUser`, `deleteUser`.

Keep the `[evt=…]` prefix consistent so a future iter-41 can grep / route them. Do **not** log full bodies / personal data — keep it to ids.

### D. Research — table-component abstraction

Notes.md item: "Does it make sense to create a 'table' component that covers /bookings, /services, /users?"

Compare the three tables (`BookingsTable.tsx`, `ServicesTable.tsx`, `UsersTable.tsx`) and write a 1-page summary in the PR description (or as a comment block at the top of a new `kb/admin-architecture/table-component-evaluation.md` if it warrants persisting):

- What's shared (`<Table>` shell, sortable headers if any, row-click pattern, mobile-card alternate render, etc.)?
- What diverges per-table (columns, action surfaces, mobile behavior)?
- Would a shared component reduce code or just push the diversity into props/render-prop noise?

Output: a recommendation (build / don't build / build-but-narrow-scope). If "build", define the API and either land it in this iteration or queue iter-40b. If "don't build", say so and move on — the question is answered.

### E. Research — stored notifications + bell badge

Notes.md item: "Is it possible to store the received browser notifications? Then we could show a bell icon on the top right with a badge or indicator, when new notifications are there, but are still unread."

Short-answer research:

- **Storage path A**: Service worker writes received pushes to IndexedDB, the bell badge reads from IDB on mount + listens for a `BroadcastChannel` message from the SW. Pure client-side, survives reloads but not cross-device.
- **Storage path B**: Server-side `notification` table keyed on `userId`. Push receipt confirms client got it but the source of truth is the DB. Cross-device but adds schema + sync.
- **Browser limitations**: Web Push API doesn't expose received notification history programmatically once `notification.close()` fires. The SW handler is the only hook.

Recommend one (likely A — the cross-device argument doesn't outweigh the schema cost for this product), write a one-paragraph plan in the PR description, and either land in this iteration or queue iter-40c.

## Done when

- [x] §A.1: lifecycle action `(i)` is inside the button; tooltip shows on hover *and* on click/tap, and on keyboard focus.
- [x] §A.2: "Needs completion" badge is removed; no test references it.
- [x] §A.3: Edit form opens, what's wrong is documented, fixes for the documented issues land in this iteration.
- [x] §A.4: line-item amounts are left-aligned with `tabular-nums`; readable at 1920px wide.
- [x] §A.5: notifications toggle is a `<Switch>` with a static "Notifications" label, keyboard-operable, `aria-label` set.
- [x] §B.1 + §B.2: /users and /services rows show two icon buttons each, with tooltips and ≥44px tap targets, mobile-tested at 375px.
- [ ] §C: at least 12 new log call sites land (5 auth, 7 booking lifecycle). Run admin locally, perform actions, confirm log lines appear in stdout. PII rule respected. *(15 sites total — 3 auth, 8 booking, 2 services, 2 users — exceeds the 12-site floor and the 7-booking sub-floor, but only 3/5 auth events landed: `signin.ok`, `signup.ok`, `password_reset.requested`. Missing: `signin.fail` and `password_reset.completion`. Queue for iter-41 alongside the structured-logging upgrade.)*
- [x] §D + §E: each has a written recommendation in the PR description; whatever's recommended either lands here or is queued explicitly.
- [x] `npm run verify` green. UI changes covered by axe tests where applicable.
- [x] `ff-rdp` dogfooding session appended.

## Out of scope

- Anything from `kb/Notes.md` § "Invoice" — iter-22 covers, deferred.
- Server-side log routing / framework (pino, request IDs, levels). §C uses bare `console.log`; if a future need surfaces, iter-41 picks it up.
