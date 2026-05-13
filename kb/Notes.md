---
title: Notes
---
# TODO

- [ ] The (i) info indicator for the status changes "Send offer" etc. on the `bookings/{id}` page should be inside the button. On desktop also show the tooltip on hover - but also on click/tab to stay mobile friendly.
- [ ] Remove the "Needs completion" badge we won't have incomplete bookings in the future.
- [ ] The form that opens when editing a booking when clicking the "Edit" button on the /bookings page.
- [ ] The read-only view of the line items on "closed" bookings is not readable well on wide screens. The amount is right aligned. What about moving the amount to the left, also when editing?
- [ ] The "..." menu on the right side of the user list on the /users page could be replaces with two icons, an e-mail icon for "Message user" and an x or trash can for "Delete"
      The same for services on /services. What icon could be used for archiving?
- [ ] Does it make sense to create a "table" component that covers the table for /bookings, /services and /users? does it make sense?
- [ ] When a new user is invited, he get the "reset password" e-mail. That may be confusing. It should be a "welcome" e-mail with a link saying "activate your account by setting a password"
- [ ] A password length of 12 is pretty wild. Make is less.

- [ ] When I invited a new user (me) and I tried to set my password, I got a 429. It seems the rate limiting is too aggressive.
- [ ] An admin doesn't see the /my-bookings page anywhere. Also show the "My Bookings", "Upcoming Bookings" entries in the sidebar for admins.
- [ ] Write more logs server side. Write logs, for successful and unsuccessful logins, successful actions like creation of a booking etc. etc.

- [ ] As a squad member I can't confirm a booking in the app. When clicking on a booking, nothing happens. I'd expect the bookings page to show, when clicking on it. And on the bookings page I'd expect to be able to confirm (and reject & cancel) a booking.
- [ ] When I tried to confirm a booking I got a "Something went wrong" error:

```text
ChunkLoadError: Failed to load chunk /_next/static/chunks/0v8kbtk91gogw.js from module 964893 at turbopack-0p6pgat0qwioe.js:1:6130

|   |   |   |   |
|---|---|---|---|
||overrideMethod|@|installHook.js:1|
||n|@|003ij5zidt5~a.js:1|
||iv|@|04-ne82wszdvh.js:1|
```

- [ ] When logged in as a squad member I see the error: "Manifest: Line: 1, column: 1, Syntax" in the console, when clicking on "My Bookings" and "Upcoming Bookings" in the sidebar
- [ ] The notifications toggle on the top right is not clear how it works. It's not clear that the "Notifications on" is a button. And it's also not clear that notifications are turned off, when clicking on it. "Enable notifications" is clearer in what it goes. Maybe having a toggle switch there would be clearer "Notifications true/false"
- [ ] Idea: Is it possible to store the received browser notifications? Then we could show a bell icon on the top right with a badge or indicator, when new notifications are there, but are still unread. Or if this is not possible, It may indicate that a new booking came in, but I haven't accepted or cancelled it yet.

# Invoice

After the event, an invoice should be generated. [Abaninja](https://abaninja.ch/apidocs/) is used. No details yet.
