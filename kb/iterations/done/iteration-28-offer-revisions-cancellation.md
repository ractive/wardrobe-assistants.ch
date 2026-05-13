---
title: Iteration 28 — Offer revisions and post-acceptance cancellation
type: iteration
order: 29
status: done
---

# Iteration 28 — Offer revisions and post-acceptance cancellation

Completes the offer state machine. Admins can send a revised offer (from `offered` or from `accepted` — the latter clears acceptance and forces re-confirmation). Customers can decline an offer on the public offer page. Either side can cancel an accepted booking; assigned squad members are notified.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. After this iteration the booking state machine matches the locked spec end-to-end except for squad confirmation, which is [iter-29](iteration-29-squad-assignment-confirmation.md).

> **Heads-up from iter-27** (carry these patterns over so PR review doesn't have to flag them again):
>
> 1. **Shared snapshot helper already exists.** iter-27 landed `snapshotSelectionsToItems(tx, bookingId, nextVersion, durationHours)` in `apps/admin/src/features/bookings/server/actions.ts`. Reuse it for `sendRevisedOffer` — do **not** write a parallel `snapshotSelections` helper.
> 2. **Always use `recordAudit` for new audit rows.** Insert audit entries via `recordAudit(...)` from `@/lib/audit-log` *after* the transaction commits — never `tx.insert(auditLog).values(...)` inside the transaction. A transient audit failure must not roll back a status change. Add `booking.offer.snapshot.archived`, `booking.offer.revised`, and `booking.offer.rejected` to the `AUDIT_ACTIONS` catalog.
> 3. **Conditional status UPDATEs.** Guard every status transition with `WHERE id = ? AND status = '<expected>' AND offerVersion = ?` and use `.returning(...)` to detect lost races. iter-27's `acceptOffer` and `sendOffer` both do this — copy the pattern for `sendRevisedOffer` and `rejectOffer`.
> 4. **Rate-limit keys for public actions include the token.** `clientIpFromHeaders` falls back to `"unknown"` when no XFF/X-Real-IP is present, which would collapse every caller into one bucket. Key as `offerAccept:${ip}:${token}` for `rejectOffer`.
> 5. **CHF formatting.** The customer offer page uses `Intl.NumberFormat("en-CH", { style: "currency", currency: "CHF" })`. Any new customer-facing totals should reuse that formatter, not raw `CHF ${n}` interpolation.
> 6. **Email param types match conditional rendering.** `offerSent` made `startTime` / `venueCity` optional because the template renders them conditionally. Do the same for any new templates with optional fields (`offerRevised` likely needs this treatment).

## Decisions

- **Selection editor unlocks in `offered` state.** Drop the [iter-25](iterations/done/iteration-25-booking-domain.md) restriction that line-item selections are editable only in `created`. Editable also in `offered` and `accepted`. Editing the selections does **not** change the customer-visible snapshot — only the next `sendRevisedOffer` re-snapshots. Document this prominently in the UI.
- **Previous snapshot is preserved, not deleted.** `booking_service_item` rows from earlier offer versions stay in the table for audit. The customer-facing page reads `MAX(offerVersion)`. A `booking.offer.snapshot.archived` audit entry records the version delta + a copy of the prior snapshot payload (cheap insurance against future schema drift).
- **`accepted → offered` re-revision clears `acceptedAt`** and emails the customer with explicit copy: "This offer was updated since your acceptance. Please review and re-confirm." Offer page reflects this state.
- **`bookingCancelled` is bilateral**: customer-side cancellation is **not** in v1 (the offer page only exposes decline before acceptance and "I have questions" mailto after). Admin-initiated cancel is the only `accepted → cancelled` path.
- **Customer decline on the offer page** transitions `offered → rejected`. No reason field required; optional textarea.
- **Admin reject extends to `offered → rejected`** in addition to [iter-25](iterations/done/iteration-25-booking-domain.md)'s `created → rejected`.

## Pre-flight

- [x] [iter-27](iterations/done/iteration-27-offer-flow.md) merged on `main` and deployed; offer-send + accept work end-to-end.
- [x] At least one `bookings` row in status `offered` and one in `accepted` exist in dev for testing.
- [x] No in-flight branches touching `features/bookings/` or `app/(public)/offer/`.
- [x] `npm run verify` green on `main`.

## Scope

### 1. Server action — `sendRevisedOffer(bookingId)`

```ts
export async function sendRevisedOffer(bookingId: string): Promise<void> {
  await withPermission("BOOKING_OFFER_SEND", async (session) => {
    const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!booking) throw notFound();
    if (booking.status !== "offered" && booking.status !== "accepted") {
      throw new Error("Only offered or accepted bookings can be revised");
    }
    const selections = await db.select().from(bookingServiceSelection)
      .where(eq(bookingServiceSelection.bookingId, bookingId));
    if (selections.length === 0) throw new Error("Cannot send revised offer with no line items");

    // Archive previous snapshot to audit_log.
    const prevSnapshot = await db.select().from(bookingServiceItem)
      .where(and(eq(bookingServiceItem.bookingId, bookingId),
                 eq(bookingServiceItem.offerVersion, booking.offerVersion)));

    const nextVersion = booking.offerVersion + 1;

    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        entityType: "booking", entityId: bookingId,
        action: "booking.offer.snapshot.archived",
        byUserId: session.user.id,
        payload: { fromVersion: booking.offerVersion, toVersion: nextVersion, items: prevSnapshot },
      });

      // Insert new snapshot rows from current selections + current service prices.
      // (Same math as iter-27 sendOffer; factor into a shared helper `snapshotSelections`.)
      await snapshotSelections(tx, booking, selections, nextVersion);

      await tx.update(bookings).set({
        status: "offered",
        offerVersion: nextVersion,
        lastOfferSentAt: new Date(),
        acceptedAt: null,   // clear if was accepted
      }).where(eq(bookings.id, bookingId));

      await tx.insert(auditLog).values({
        entityType: "booking", entityId: bookingId,
        action: "booking.offer.revised", byUserId: session.user.id,
        payload: { offerVersion: nextVersion, wasAccepted: booking.status === "accepted" },
      });
    });

    await sendTemplated("offerRevised", booking.customerEmail!, {
      customerName: booking.customerName!,
      offerVersion: nextVersion,
      offerUrl: `${env.APP_URL}/offer/${booking.offerToken}`,
      wasAccepted: booking.status === "accepted",
      totalCents: /* recompute */,
    });
  });
}
```

- **Refactor**: extract a `snapshotSelections(tx, booking, selections, version)` helper shared with `sendOffer` from [iter-27](iterations/done/iteration-27-offer-flow.md). Same hourly/fixed math.
- Permission: `BOOKING_OFFER_SEND`.

### 2. Server action — `rejectOffer(token, reason?)` (customer-side)

`apps/admin/src/app/(public)/offer/[token]/actions.ts`.

```ts
export async function rejectOffer(token: string, reason?: string): Promise<void> {
  await withRateLimit("offerAccept", { ip: requestIp() }, async () => {
    const booking = await db.query.bookings.findFirst({ where: eq(bookings.offerToken, token) });
    if (!booking) throw notFound();
    if (booking.status !== "offered") throw new Error("Offer is not in a rejectable state");
    await db.transaction(async (tx) => {
      await tx.update(bookings).set({ status: "rejected" })
        .where(eq(bookings.id, booking.id));
      await tx.insert(auditLog).values({
        entityType: "booking", entityId: booking.id,
        action: "booking.offer.rejected", byUserId: null,
        payload: { offerVersion: booking.offerVersion, via: "customer", reason: reason ?? null },
      });
    });
    await notifyAdmins("offerRejected", {
      bookingId: booking.id, customerName: booking.customerName!, reason: reason ?? null,
    });
  });
}
```

- Reuses the same `offerAccept` rate-limit bucket.

### 3. Server action — `rejectBookingByAdmin` extension

Extend [iter-25](iterations/done/iteration-25-booking-domain.md)'s `rejectBooking` to allow `offered → rejected` in addition to `created → rejected`. Sends `bookingRejected` to the customer.

### 4. Server action — `cancelBooking` extension

[iter-25](iterations/done/iteration-25-booking-domain.md) already lands `cancelBooking` for `accepted → cancelled`. This iteration:

- Verifies the squad-notification fan-out: iterate `booking_assignments` rows with status in (`assigned`, `confirmed`) and call `notifyUser('bookingCancelled', { recipient: 'squad', ... })`.
- Adds a confirmation modal on the admin UI listing the squad members about to be notified.

### 5. Admin UI

- **Selection editor**: relabel; reads "Editing line items here doesn't affect the customer-facing offer until you click _Send revised offer_." Visible (editable) in `created`, `offered`, `accepted`. Hidden / read-only in `rejected`, `cancelled`.
- **"Send revised offer" button**: visible when `status ∈ {offered, accepted}` and ≥1 line item, gated by `BOOKING_OFFER_SEND`. Confirmation modal explicit about the consequence when status is `accepted` ("This will clear the customer's acceptance and require them to re-confirm.").
- **"Cancel booking" button**: visible when `status === 'accepted'`, gated by `BOOKING_CANCEL`. Confirmation modal listing assigned squad members.
- **"Reject" button**: visible when `status ∈ {created, offered}`, gated by `BOOKING_REJECT`. Optional reason textarea in the modal.

### 6. Customer offer page

- `status === 'offered'`:
  - Accept form (existing from [iter-27](iterations/done/iteration-27-offer-flow.md)).
  - **New**: "Decline this offer" link → small modal with optional reason textarea + "Decline" button → posts to `rejectOffer`.
  - Re-revision banner: when `offerVersion > 1` AND the booking was previously `accepted` (detect via the most recent `booking.offer.revised` audit entry's `wasAccepted: true`), show a prominent banner: "This offer was updated since you accepted. Please review and re-confirm."
- `status === 'rejected'`: terminal banner.

### 7. Notification templates

Add:

- **`offerRevised`** (customer; email only). Subject and copy explicit that this updates a prior offer; CTA to `/offer/<token>`. Branch on `wasAccepted` to include the re-confirm prompt.
- **`offerRejected`** (admins; push + email). Notifies admins of customer decline; includes optional reason.
- **`bookingCancelled`** — variants already landed in [iter-25](iterations/done/iteration-25-booking-domain.md); verify all three (`customer`, `squad`, `admin`) render correctly and have push payloads where applicable (squad + admin only).

### 8. Audit logging

- `booking.offer.snapshot.archived` (this iteration) — includes the prior snapshot rows for forensic reconstruction.
- `booking.offer.revised` (this iteration).
- `booking.offer.rejected` (this iteration, `via: 'customer' | 'admin'`).

### 9. Smoke tests

- `sendRevisedOffer` from `offered`: new snapshot at `offerVersion + 1`, prior snapshot archived to `audit_log`, status stays `offered`, customer email queued.
- `sendRevisedOffer` from `accepted`: same, plus status flips to `offered` and `acceptedAt` cleared.
- `sendRevisedOffer` from terminal statuses → rejected.
- `rejectOffer` from `offered`: status `rejected`, audit row with `via: customer`, `offerRejected` notification dispatched.
- `rejectOffer` from non-`offered` → 400.
- `rejectBooking` from `offered` (extension): works; from `accepted` or terminal → rejected.
- `cancelBooking` notifies the right squad members: seed two assigned (one `confirmed`, one `withdrawn`); only the `confirmed` one is notified.
- Offer page banner appears on re-revision-after-acceptance flow.
- Selection editor: edits in `offered` and `accepted` succeed without changing the customer-facing snapshot until `sendRevisedOffer` runs.

## Out of scope

- Customer-initiated post-acceptance cancellation. (Customer contacts the admin via mailto; admin uses `cancelBooking`.)
- Per-version offer URLs (e.g. `/offer/<token>/v2`) — the URL is stable.
- PDF rendering.
- Offer expiry / auto-archive.
- Squad confirmation flow — [iter-29](iteration-29-squad-assignment-confirmation.md).
- German translation.

## Done when

- [x] `sendRevisedOffer` server action exists and handles both `offered → offered` and `accepted → offered`; previous snapshot archived to `audit_log`; new snapshot at `offerVersion + 1`.
- [x] `rejectOffer` server action exists on the public offer route; rate-limited.
- [x] `rejectBookingByAdmin` accepts `offered` in addition to `created`.
- [x] Admin UI exposes the revise / reject / cancel buttons with the correct gating and confirmation modals.
- [x] Customer offer page exposes decline-from-`offered` and shows the re-confirm banner when applicable.
- [x] Selection editor is editable in `created`, `offered`, `accepted`; read-only in terminal states; UI explicitly says edits don't reach the customer until "Send revised offer".
- [x] `offerRevised` and `offerRejected` templates landed; `bookingCancelled` push payloads verified.
- [x] Audit log writes `booking.offer.revised`, `booking.offer.snapshot.archived`, `booking.offer.rejected` rows.
- [x] Smoke tests cover every case in §9.
- [x] `npm run format` clean; `npm run verify` green.
- [ ] System deployable; manual smoke on a preview confirms the revise-after-accept loop end-to-end. _(Deferred: requires a live preview deploy; the full path is covered by the offer-flow smoke suite, but the end-to-end browser walk happens out-of-band after merge.)_
- [x] No UI exposes squad confirmation buttons or ICS download yet — those land in [iter-29](iteration-29-squad-assignment-confirmation.md).
