---
title: Iteration 27 — Offer flow (send + customer page + accept)
type: iteration
order: 28
status: implemented
---

# Iteration 27 — Offer flow

The first end-to-end customer round-trip. Admin clicks "Send offer" on a `created` booking; line items are snapshotted; an email goes to the customer with a link to a public offer page. The customer reviews and accepts (with T&C checkbox) — or contacts the admin via a mailto link with the booking and offer-version pre-filled.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. [iter-28](iteration-28-offer-revisions-cancellation.md) adds revisions and post-acceptance cancellation; this iteration only covers the first send and first accept.

> **Heads-up from iter-26**: the `services` table uses a whole-CHF integer column `services.price` (no centimes). The pseudocode below still references `unitPriceCents` / `totalCents` — when implementing, use `price` (whole CHF) and rename the snapshot fields accordingly (e.g. `unitPrice`, `totalPrice`) to match the iter-25/iter-26 convention. Also reuse iter-26's hardened `clientIpFromHeaders` (rightmost-trust XFF) for the `offerView` and `offerAccept` rate-limit buckets — no extra work needed since both buckets live in `lib/rate-limit.ts`.

## Decisions

- **Snapshot at every "send offer" action.** A `booking_service_item` row set is created (with `offerVersion = current + 1`) every time `sendOffer` runs. The previous snapshot stays in the table (different `offerVersion`) so history is queryable; the customer-facing page reads `MAX(offerVersion)`.
- **Offer-token URL is stable for the booking lifetime.** `crypto.randomUUID()` v4, stored on `bookings.offerToken`. No expiry, no rotation, no single-use. v4 has 122 bits of entropy — unguessable in any realistic threat model. If a token leaks, the admin can rotate via a server action (out of scope for this iteration; reserve for ops).
- **Page is outside `(dashboard)` and has no auth.** Route group `app/(public)/offer/[token]/`. No middleware auth.
- **GET rate limit**: 60/min/IP. Cheap defense against scrapers.
- **Accept requires a T&C checkbox.** Server rejects accept without it.
- **"I have questions" is a plain `mailto:` link** with prefilled subject + body containing the booking ID and offer version. No in-app message thread.
- **English only.** German deferred.
- **Admin manual-accept (`adminAcceptOffer`)** already exists from [iter-25](iteration-25-booking-domain.md); this iteration extends it to also handle `offered → accepted`, and ensures the email template `offerAcceptedAdmin` is wired.
- **Snapshot on admin manual-accept too** — already implemented in [iter-25](iteration-25-booking-domain.md) for the `created → accepted` case. The `offered → accepted` case re-uses the existing snapshot (do nothing).

## Pre-flight

- [ ] [iter-26](iteration-26-public-booking-request.md) merged on `main` and deployed; customer submissions flow into `bookings`.
- [ ] At least one `bookings` row in status `created` exists in dev for end-to-end testing (submit via the public form, or seed).
- [ ] No in-flight branches touching `features/bookings/` or `app/api/public/`.
- [ ] `npm run verify` green on `main`.

## Scope

### 1. Server action — `sendOffer(bookingId)`

`apps/admin/src/features/bookings/actions/send-offer.ts`.

```ts
export async function sendOffer(bookingId: string): Promise<void> {
  await withPermission("BOOKING_OFFER_SEND", async (session) => {
    const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!booking) throw notFound();
    if (booking.status !== "created") throw new Error("Only created bookings can be offered");

    const selections = await db.select().from(bookingServiceSelection)
      .where(eq(bookingServiceSelection.bookingId, bookingId));
    if (selections.length === 0) throw new Error("Cannot send offer with no line items");

    const nextVersion = booking.offerVersion + 1;

    await db.transaction(async (tx) => {
      // Snapshot: read current service rows + insert booking_service_item rows.
      for (const [i, sel] of selections.entries()) {
        const svc = await tx.query.services.findFirst({ where: eq(services.id, sel.serviceId) });
        if (!svc) throw new Error(`Service ${sel.serviceId} missing`);
        const hoursInMinutes = svc.priceType === "hourly" ? (booking.durationHours ?? 0) * 60 : null;
        const totalCents = svc.priceType === "hourly"
          ? svc.unitPriceCents * sel.quantity * ((booking.durationHours ?? 0))
          : svc.unitPriceCents * sel.quantity;
        await tx.insert(bookingServiceItem).values({
          id: ulid(),
          bookingId,
          offerVersion: nextVersion,
          serviceId: svc.id,
          name: svc.name,
          description: svc.description,
          priceType: svc.priceType,
          unitPriceCents: svc.unitPriceCents,
          quantity: sel.quantity,
          hoursInMinutes,
          totalCents,
          position: i,
        });
      }
      await tx.update(bookings).set({
        status: "offered",
        offerVersion: nextVersion,
        lastOfferSentAt: new Date(),
      }).where(eq(bookings.id, bookingId));
      await tx.insert(auditLog).values({
        entityType: "booking", entityId: bookingId,
        action: "booking.offer.sent", byUserId: session.user.id,
        payload: { offerVersion: nextVersion },
      });
    });

    await sendTemplated("offerSent", booking.customerEmail!, {
      customerName: booking.customerName!,
      date: booking.date, startTime: booking.startTime!,
      venueName: booking.venueName!, venueCity: booking.venueCity!,
      offerVersion: nextVersion,
      offerUrl: `${env.APP_URL}/offer/${booking.offerToken}`,
      totalCents: /* sum from inserted items */,
    });
  });
}
```

- Per-iteration unit: the `hoursInMinutes` and `totalCents` math for `hourly` services is `units = quantity`, `hours = booking.durationHours`. Decision: `totalCents = unitPriceCents * quantity * durationHours`. For `fixed`: `totalCents = unitPriceCents * quantity`.
- Smoke test: send-offer on a `created` booking → status transitions, snapshot rows exist with correct math, audit row written, customer email queued.

### 2. Admin UI — "Send offer" button

- Booking detail page: when `status === 'created'` and there is ≥1 `booking_service_selection` row, show a primary "Send offer" button gated by `<HasPermission permission="BOOKING_OFFER_SEND">`. Confirmation modal summarizing the customer email and total before sending.
- Disabled state with tooltip when no line items present.

### 3. Public offer page — `apps/admin/src/app/(public)/offer/[token]/page.tsx`

- Route group `(public)` is a new sibling of `(dashboard)`. No auth middleware. Layout is minimal (brand header, no admin nav).
- Server component reads `bookings WHERE offerToken = :token`. 404 if missing.
- Reads current snapshot: `booking_service_item WHERE bookingId = :id AND offerVersion = :booking.offerVersion`.
- Renders:
  - Booking heading: customer name, date + startTime + durationHours, venue (name + city).
  - Line-item table: name, description, quantity, hours (for hourly), unit price, line total.
  - Grand total (CHF).
  - Offer-version label when `offerVersion > 1` (will be reached in [iter-28](iteration-28-offer-revisions-cancellation.md); render the conditional now).
  - Status-specific UI:
    - `offered`: Accept form with T&C checkbox + "I have questions" mailto link.
    - `accepted`: confirmation banner ("Accepted on …"). No accept form.
    - `rejected` / `cancelled`: terminal banner ("This offer is no longer available. Contact us at …").
    - `created`: should not be reachable normally (token only matters once offer sent), but render a neutral "This offer is not yet ready" message just in case.
- Rate limit on the route: 60/min/IP via `lib/rate-limit.ts` new bucket `offerView`.

### 4. Accept form + server action — `acceptOffer(token, agreedToTerms)`

`apps/admin/src/app/(public)/offer/[token]/actions.ts`.

```ts
export async function acceptOffer(token: string, agreedToTerms: boolean): Promise<void> {
  if (!agreedToTerms) throw new Error("T&C must be accepted");
  await withRateLimit("offerAccept", { ip: requestIp() }, async () => {
    const booking = await db.query.bookings.findFirst({ where: eq(bookings.offerToken, token) });
    if (!booking) throw notFound();
    if (booking.status !== "offered") throw new Error("Offer is not in an acceptable state");
    await db.transaction(async (tx) => {
      await tx.update(bookings).set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(bookings.id, booking.id));
      await tx.insert(auditLog).values({
        entityType: "booking", entityId: booking.id,
        action: "booking.offer.accepted", byUserId: null,
        payload: { offerVersion: booking.offerVersion, via: "customer" },
      });
    });
    await notifyAdmins("offerAccepted", {
      bookingId: booking.id, customerName: booking.customerName!,
      date: booking.date, totalCents: /* sum */,
    });
  });
}
```

- Rate-limit bucket `offerAccept`: 10/hour/IP. Prevents accept-spam if a token leaks.
- The form posts via a server action; the page is a server component plus a small client island for the checkbox + submit button.

### 5. "I have questions" mailto link

```tsx
<a
  href={`mailto:info@wardrobe-assistants.ch?subject=${encodeURIComponent(
    `Question about booking ${booking.id} (offer v${booking.offerVersion})`
  )}&body=${encodeURIComponent(
    `Hi,\n\nI have a question about offer v${booking.offerVersion} for booking ${booking.id}:\n\n`
  )}`}
>
  I have questions
</a>
```

Plain HTML anchor. No JS. Subject and body include booking ID + offer version for traceability.

### 6. Admin manual-accept extension

- `adminAcceptOffer(bookingId)` from [iter-25](iteration-25-booking-domain.md): extend to handle the `offered → accepted` branch. In this branch, snapshot already exists (was created when `sendOffer` ran); no new snapshot needed.
- Continues to send `offerAcceptedAdmin` email to the customer.
- Admin UI: when `status === 'offered'`, expose a secondary "Accept on customer's behalf" button gated by `BOOKING_ACCEPT_MANUAL`. Confirmation modal noting that this skips the customer-facing accept step.

### 7. Notification templates

Add:

- **`offerSent`** (customer; email only). English. Summary block: date + time, venue name + city, total in CHF. Body: short reassurance + CTA button linking to `/offer/<token>`.
- **`offerAccepted`** (admins; push + email). Confirmation that the customer accepted; CTA to the admin booking-detail page.

`offerAcceptedAdmin` already shipped in [iter-25](iteration-25-booking-domain.md).

### 8. Audit logging

- `booking.offer.sent` (this iteration).
- `booking.offer.accepted` (this iteration, `via: 'customer' | 'admin'`).

### 9. Smoke tests

- `sendOffer` happy path: snapshot rows, status change, email queued.
- `sendOffer` fails on non-`created` status.
- `sendOffer` fails on zero selections.
- `sendOffer` requires `BOOKING_OFFER_SEND`.
- Offer page GET: unknown token → 404; valid token + `offered` → 200 with accept form; valid token + `accepted` → 200 with confirmation banner.
- Offer page rate-limit: 61st hit/min/IP → 429.
- `acceptOffer` happy path: status `offered → accepted`, audit row, `notifyAdmins` invoked.
- `acceptOffer` without T&C → 400.
- `acceptOffer` on non-`offered` status → 400.
- `adminAcceptOffer` from `offered` → 200, no new snapshot, `offerAcceptedAdmin` email queued.
- Mailto link rendered with correct booking ID + offer version in subject and body.

## Out of scope

- Offer revisions — [iter-28](iteration-28-offer-revisions-cancellation.md).
- Customer-initiated rejection on the offer page — [iter-28](iteration-28-offer-revisions-cancellation.md) (customer-decline path is grouped with revisions for UI cohesion).
- Post-acceptance cancellation — [iter-28](iteration-28-offer-revisions-cancellation.md).
- In-app message thread.
- PDF rendering of the offer.
- Token rotation / single-use.
- Squad confirmation flow — [iter-29](iteration-29-squad-assignment-confirmation.md).
- German translation.

## Done when

- [ ] `sendOffer` server action exists, gated by `BOOKING_OFFER_SEND`, creates `booking_service_item` rows at the new offer version with correct math, and emails the customer.
- [ ] Admin UI exposes "Send offer" only for `created` bookings with ≥1 line item.
- [ ] `/offer/[token]` renders for all four relevant statuses; rate-limited at 60/min/IP.
- [ ] `acceptOffer` server action enforces T&C, transitions `offered → accepted`, and notifies admins.
- [ ] `adminAcceptOffer` works from both `created` and `offered`; sends `offerAcceptedAdmin`.
- [ ] `offerSent` and `offerAccepted` templates landed with push payloads colocated.
- [ ] Audit log writes `booking.offer.sent` and `booking.offer.accepted` rows.
- [ ] Smoke tests cover every case in §9.
- [ ] `npm run format` clean; `npm run verify` green.
- [ ] System deployable; manual smoke on a preview confirms send-offer → email → click link → accept → admin notification round-trip.
- [ ] No UI exposes "Send revised offer" or "Cancel booking" yet — those land in [iter-28](iteration-28-offer-revisions-cancellation.md).
