---
title: Notes
---
# TODO

- [x] The (i) info indicator for the status changes "Send offer" etc. on the `bookings/{id}` page should be inside the button. On desktop also show the tooltip on hover - but also on click/tab to stay mobile friendly.
- [x] Remove the "Needs completion" badge we won't have incomplete bookings in the future.
- [x] The form that opens when editing a booking when clicking the "Edit" button on the /bookings page.
- [ ] Move the line-item amount to the LEFT on wide screens, in both the read-only view of closed bookings AND the editable view (the selectable number input on non-closed bookings). Total stays right-aligned. → iter-42 §A
- [x] The "..." menu on the right side of the user list on the /users page could be replaces with two icons, an e-mail icon for "Message user" and an x or trash can for "Delete"
      The same for services on /services. What icon could be used for archiving?
- [x] ~~Shared table component for /bookings, /services, /users~~ — decided against. Tables differ too much (row click semantics, action columns, badges) and we don't expect enough new list pages to amortize the abstraction. Keep them separate; extract small shared bits (empty state, mobile-card list) only if they accumulate.
- [x] When a new user is invited, he get the "reset password" e-mail. That may be confusing. It should be a "welcome" e-mail with a link saying "activate your account by setting a password"
- [x] A password length of 12 is pretty wild. Make is less.

- [x] When I invited a new user (me) and I tried to set my password, I got a 429. It seems the rate limiting is too aggressive.
- [x] An admin doesn't see the /my-bookings page anywhere. Also show the "My Bookings", "Upcoming Bookings" entries in the sidebar for admins.
- [ ] Write more server-side console logs — plain human-readable strings (NOT structured JSON), just for tail-viewing. Don't go overboard. Cover the key events: e.g. `booking <id> created by admin james@ractive.ch`, login success/fail (with reason), status changes, permission denials, unhandled errors. Goal: meaningful trail when reading `bunny logs`, not an analytics pipeline. → iter-42 §B

- [x] As a squad member I can't confirm a booking in the app. When clicking on a booking, nothing happens. I'd expect the bookings page to show, when clicking on it. And on the bookings page I'd expect to be able to confirm (and reject & cancel) a booking.
- [x] When I tried to confirm a booking I got a "Something went wrong" error (most probably fixed):

```text
ChunkLoadError: Failed to load chunk /_next/static/chunks/0v8kbtk91gogw.js from module 964893 at turbopack-0p6pgat0qwioe.js:1:6130

|   |   |   |   |
|---|---|---|---|
||overrideMethod|@|installHook.js:1|
||n|@|003ij5zidt5~a.js:1|
||iv|@|04-ne82wszdvh.js:1|
```

- [x] When logged in as a squad member I see the error: "Manifest: Line: 1, column: 1, Syntax" in the console, when clicking on "My Bookings" and "Upcoming Bookings" in the sidebar (seems fixed)
- [x] The notifications toggle on the top right is not clear how it works. It's not clear that the "Notifications on" is a button. And it's also not clear that notifications are turned off, when clicking on it. "Enable notifications" is clearer in what it goes. Maybe having a toggle switch there would be clearer "Notifications true/false"
- [ ] Bell icon w/ unread badge in the header, next to the notifications toggle. Purely derived from domain state — no persistence of push messages.
      - Squad members: bookings assigned to me with `status = pending_confirmation`.
      - Admins: only **unassigned** pending bookings (not every pending booking — otherwise the badge is always non-zero).
      - Click bell → dropdown listing those items, each linking to the booking page.
      - Badge clears naturally when the underlying state changes (confirm / decline / assign). No "mark read" UI.
      - Refresh on focus + light poll (~60s), or piggyback on the existing push channel if open.
      - → iter-42 §C
## 2026-05-13
- [x] Confirmed: db is not used directly in page.tsx — calls are abstracted into `features/bookings/server/queries.ts` (e.g. `getBookingById`, `listAssignableUsers`).
- [ ] Add an (i) icon beside the Notifications toggle with a help tooltip (hover on desktop / tap on mobile). Draft copy: "Get a browser notification when a booking needs your attention — a new request for admins, or a new assignment to confirm for squad members. Notifications work even when the tab is closed. You can turn them off again any time." → iter-42 §D
- [ ] Only show the help tooltip for the buttons on the /bookings/{id} page when hovering over the (i) icon and not when hovering over the rest of the button → iter-42 §E
# Invoice

After the event, an invoice should be generated. [Abaninja](https://abaninja.ch/apidocs/) is used. No details yet.
