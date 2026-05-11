"use server";

import {
  auditLog,
  bookingServiceItem,
  bookings,
} from "@wardrobe-assistants/db/schema";
import { format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { ulid } from "ulid";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notifyAdmins } from "@/lib/notify";
import { clientIpFromHeaders, consume, RATE_LIMITS } from "@/lib/rate-limit";

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
  const rl = consume(`offerAccept:${ip}`, RATE_LIMITS.offerAccept);
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
  if (booking.status !== "offered") {
    return {
      error: true,
      message: "This offer is not in an acceptable state.",
    };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(bookings)
      .set({ status: "accepted", acceptedAt: now, updatedAt: now })
      .where(eq(bookings.id, booking.id));

    await tx.insert(auditLog).values({
      id: ulid(),
      actorUserId: "customer",
      action: "booking.offer.accepted",
      targetType: "booking",
      targetId: booking.id,
      metadata: JSON.stringify({
        offerVersion: booking.offerVersion,
        via: "customer",
      }),
      createdAt: now,
    });
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
  const grandTotal = itemRows.reduce((sum, r) => sum + r.total, 0);

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
