"use server";

import { bookingServiceItem, bookings } from "@wardrobe-assistants/db/schema";
import { format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notifyAdmins } from "@/lib/notify";
import { clientIpFromHeaders, consume, RATE_LIMITS } from "@/lib/rate-limit";

export type ActionResult = { error: true; message: string } | { error: false };

function formatChfTotal(total: number): string {
  return `CHF ${total.toLocaleString("en-CH")}.-`;
}

export async function acceptOffer(
  token: string,
  agreedToTerms: boolean,
): Promise<{ error: true; message: string } | { error: false }> {
  if (!agreedToTerms) {
    return {
      error: true,
      message: "You must agree to the terms and conditions to accept.",
    };
  }

  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  // Include the token in the rate-limit key so a missing/unknown IP doesn't
  // collapse every accept attempt into one global bucket.
  const rl = consume(`offerAccept:${ip}:${token}`, RATE_LIMITS.offerAccept);
  if (!rl.allowed) {
    return {
      error: true,
      message: "Too many requests. Please try again later.",
    };
  }

  const bookingRows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.offerToken, token))
    .limit(1);
  const booking = bookingRows[0];
  if (!booking) {
    return { error: true, message: "Offer not found." };
  }
  // Idempotent: a refresh after a slow accept lands here on the second
  // request — treat as success rather than surfacing a scary error.
  if (booking.status === "accepted") {
    return { error: false };
  }
  if (booking.status !== "offered") {
    return {
      error: true,
      message: "This offer is not in an acceptable state.",
    };
  }

  const now = new Date();
  // Guard the UPDATE on status + offerVersion so two concurrent accepts can't
  // both succeed. The audit row is written after the transaction commits via
  // `recordAudit` (which swallows failures) so a transient audit-log issue
  // can't roll back the customer's acceptance.
  const updated = await db
    .update(bookings)
    .set({ status: "accepted", acceptedAt: now, updatedAt: now })
    .where(
      and(
        eq(bookings.id, booking.id),
        eq(bookings.status, "offered"),
        eq(bookings.offerVersion, booking.offerVersion),
      ),
    )
    .returning({ id: bookings.id });
  if (updated.length === 0) {
    // Lost the race: another concurrent request flipped the row. Re-read to
    // decide whether to treat that as success (now accepted) or surface an
    // error.
    const after = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    if (after[0]?.status === "accepted") return { error: false };
    return {
      error: true,
      message: "This offer is not in an acceptable state.",
    };
  }

  await recordAudit({
    actorUserId: "customer",
    action: "booking.offer.accepted",
    targetType: "booking",
    targetId: booking.id,
    metadata: { offerVersion: booking.offerVersion, via: "customer" },
  });

  // Best-effort admin notification.
  const itemRows = await db
    .select({ total: bookingServiceItem.total })
    .from(bookingServiceItem)
    .where(
      and(
        eq(bookingServiceItem.bookingId, booking.id),
        eq(bookingServiceItem.offerVersion, booking.offerVersion),
      ),
    );
  const grandTotal = itemRows.reduce((sum, r) => sum + (r.total ?? 0), 0);

  notifyAdmins("offerAccepted", {
    bookingId: booking.id,
    customerName: booking.customerName ?? "Customer",
    date: format(booking.date, "EEEE, d MMMM yyyy"),
    bookingUrl: `${env.betterAuthUrl}/bookings/${booking.id}`,
    totalFormatted: formatChfTotal(grandTotal),
  }).catch((err) => {
    console.error("[acceptOffer] notifyAdmins failed", err);
  });

  return { error: false };
}

// iter-28: customer declines the offer on the public offer page.
// Rate-limited with the same offerAccept bucket (per-IP + per-token).
export async function rejectOffer(
  token: string,
  reason?: string,
): Promise<ActionResult> {
  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  // Keyed by IP + token so a missing/unknown IP doesn't collapse every caller
  // into one bucket — consistent with acceptOffer.
  const rl = consume(`offerAccept:${ip}:${token}`, RATE_LIMITS.offerAccept);
  if (!rl.allowed) {
    return {
      error: true,
      message: "Too many requests. Please try again later.",
    };
  }

  // Bound unauthenticated input so a single request can't bloat audit rows or
  // admin emails. Trim + cap at 2000 chars, treat empty as absent.
  const trimmedReason = reason?.trim();
  const normalizedReason =
    trimmedReason && trimmedReason.length > 0
      ? trimmedReason.slice(0, 2_000)
      : undefined;

  const bookingRows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.offerToken, token))
    .limit(1);
  const booking = bookingRows[0];
  if (!booking) {
    return { error: true, message: "Offer not found." };
  }
  // Idempotent: a repeat request after a successful decline should not error.
  if (booking.status === "rejected") {
    return { error: false };
  }
  if (booking.status !== "offered") {
    return {
      error: true,
      message: "This offer is not in a declinable state.",
    };
  }

  const now = new Date();
  // Guard the UPDATE on status + offerVersion to detect lost races.
  const updated = await db
    .update(bookings)
    .set({ status: "rejected", updatedAt: now })
    .where(
      and(
        eq(bookings.id, booking.id),
        eq(bookings.status, "offered"),
        eq(bookings.offerVersion, booking.offerVersion),
      ),
    )
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    // Lost the race — re-read to determine the right response.
    const after = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    if (after[0]?.status === "rejected") return { error: false };
    return {
      error: true,
      message: "This offer is not in a declinable state.",
    };
  }

  await recordAudit({
    actorUserId: "customer",
    action: "booking.offer.rejected",
    targetType: "booking",
    targetId: booking.id,
    metadata: {
      offerVersion: booking.offerVersion,
      via: "customer",
      reason: normalizedReason ?? null,
    },
  });

  // Best-effort admin notification.
  notifyAdmins("offerRejected", {
    customerName: booking.customerName ?? "Customer",
    bookingUrl: `${env.betterAuthUrl}/bookings/${booking.id}`,
    reason: normalizedReason,
  }).catch((err) => {
    console.error("[rejectOffer] notifyAdmins failed", err);
  });

  return { error: false };
}
