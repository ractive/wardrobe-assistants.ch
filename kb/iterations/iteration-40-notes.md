---
title: Iteration 40 — implementation notes
type: iteration-notes
status: complete
order: 41.5
---

## §A.3 — Booking Edit form inspection findings and fixes

**What was inspected**: `BookingForm.tsx` (create + edit modes) and `BookingDialog.tsx` (the shadcn `<Dialog>` wrapper). The dialog uses the shadcn `<Dialog>` which natively provides Esc-to-close via Radix's `DialogContent` keyboard handler — no additional work needed there.

**Issues found and fixed**:

- **Missing autofocus on first field**: the Name `<Input>` had no `autoFocus` attribute. Fixed: added `autoFocus` to the Name field so keyboard users can start typing immediately when the dialog opens. The shadcn Dialog's `DialogContent` manages focus on open; `autoFocus` within the form body then moves focus to the first input.
- **Per-field validation messages**: already present via `<FormMessage />` from RHF + shadcn `<Form>`. No change needed.
- **Layout shift on open**: the dialog uses `sm:max-w-lg` which is stable. No layout shift observed.
- **Esc close**: confirmed — Radix `DialogContent` handles `onKeyDown` for Escape natively. No change needed.

**Summary**: one fix applied (`autoFocus` on the Name field). The rest were already handled by the RHF+shadcn form system.

## §E — Stored notifications + bell badge: research

**Question**: can we store received browser push notifications and show a bell badge for unread ones?

**Path A (recommended) — IndexedDB + BroadcastChannel**:
The service worker's `push` event handler is the only reliable hook into received notifications — the Web Push API doesn't expose notification history once `notification.close()` fires. The handler can write each received push payload to IndexedDB (keyed by userId + timestamp). The bell badge component reads from IDB on mount and subscribes to a `BroadcastChannel` message from the SW so new pushes update the badge in real time without a reload. This is purely client-side, survives page reloads, and needs no schema changes.

**Path B — server-side `notification` table**:
Adds a DB table keyed on `userId` + `notificationId`. Cross-device (same badge on mobile + desktop), but requires a new Drizzle schema, a server action to mark notifications read, and a polling or websocket mechanism to update the badge. The cross-device benefit doesn't outweigh the schema + sync cost for this product (single admin surface, low notification volume).

**Recommendation**: implement Path A in iter-40c. The SW already handles push events (`sw.js`); extend it to write to IDB and broadcast on receipt. The bell component reads IDB on mount and wires up the BroadcastChannel listener. Mark-as-read clears the IDB entries. Estimated scope: one SW change + one new React component. Not landing in iter-40 — too speculative for the current scope; explicitly queued as iter-40c.
