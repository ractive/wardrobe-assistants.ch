# Booking-request end-to-end smoke (manual)

iter-38 §D.3 — Walk-through smoke for the customer booking-request flow.
Run interactively after each prod deploy of the homepage + admin pair, or
when the booking-request contract changes.

## Pre-requisites

- A clean browser session (incognito) on a fresh device.
- Admin push enabled + a logged-in admin user on a second device/window to
  observe inbound notifications.
- Email inbox access for the admin notification target.

## Steps

- [ ] Open `https://wardrobe-assistants.ch/` in incognito.
- [ ] Click the hero CTA — lands on `/booking-request`.
- [ ] Confirm the service catalog renders at least one card (no empty list).
- [ ] Pick a service, advance to the form step.
- [ ] Fill the form with an **invalid** email (e.g. `not-an-email`) and submit.
- [ ] Confirm the email field shows a validation error inline (no full-page reload).
- [ ] Correct the email to a valid address, submit again.
- [ ] Confirm the success state renders (thank-you copy + next-steps).
- [ ] On the admin device: confirm a push notification arrives within ~30s.
- [ ] Confirm an email notification arrives within ~2min.
- [ ] In the admin, open `/bookings?status=new-requests` — the new booking
      is visible at the top of the list.
- [ ] Click into the new booking detail page — all submitted fields render
      correctly (no truncation, no `null` / `undefined`).

## On failure

- Capture the network request that returned the error (DevTools → Network).
- Note the offending step number.
- Open an iter-38b follow-up if the failure is a palette / contrast issue;
  otherwise file an iter-31-followup issue.
