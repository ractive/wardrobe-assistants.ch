import {
  auditLog,
  bookingServiceItem,
  bookings,
} from "@wardrobe-assistants/db/schema";
import { format } from "date-fns";
import { and, asc, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clientIpFromHeaders, consume, RATE_LIMITS } from "@/lib/rate-limit";
import { AcceptForm } from "./AcceptForm";
import { DeclineForm } from "./DeclineForm";

export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  // Include the token in the key so a missing/unknown IP doesn't share one
  // global bucket across all visitors.
  const rl = consume(`offerView:${ip}:${token}`, RATE_LIMITS.offerView);
  if (!rl.allowed) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-[var(--muted-foreground)] text-sm">
          Too many requests. Please try again in a moment.
        </p>
      </div>
    );
  }

  const bookingRows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.offerToken, token))
    .limit(1);
  const booking = bookingRows[0];
  if (!booking) notFound();

  const lineItems =
    booking.offerVersion > 0
      ? await db
          .select()
          .from(bookingServiceItem)
          .where(
            and(
              eq(bookingServiceItem.bookingId, booking.id),
              eq(bookingServiceItem.offerVersion, booking.offerVersion),
            ),
          )
          .orderBy(asc(bookingServiceItem.position))
      : [];

  // iter-28: detect re-revision-after-acceptance to show a re-confirm banner.
  // Read the most recent booking.offer.revised audit row for this booking.
  // If wasAccepted=true in its metadata, the customer needs to re-confirm.
  let showReconfirmBanner = false;
  if (booking.status === "offered" && booking.offerVersion > 1) {
    const revisionRows = await db
      .select({ metadata: auditLog.metadata })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetType, "booking"),
          eq(auditLog.targetId, booking.id),
          eq(auditLog.action, "booking.offer.revised"),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const latestRevision = revisionRows[0];
    if (latestRevision?.metadata) {
      try {
        const parsed: unknown = JSON.parse(latestRevision.metadata);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "wasAccepted" in parsed &&
          (parsed as Record<string, unknown>).wasAccepted === true
        ) {
          showReconfirmBanner = true;
        }
      } catch {
        // Malformed metadata — ignore gracefully.
      }
    }
  }

  const grandTotal = lineItems.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const dateStr = format(booking.date, "EEEE, d MMMM yyyy");
  const chf = new Intl.NumberFormat("en-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-semibold text-2xl">Your offer</h1>
        {booking.offerVersion > 1 && (
          <p className="text-[var(--muted-foreground)] text-sm">
            Offer version {booking.offerVersion}
          </p>
        )}
      </header>

      <section className="space-y-1">
        <h2 className="font-medium text-sm text-[var(--muted-foreground)] uppercase tracking-wide">
          Event details
        </h2>
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            {booking.customerName && (
              <>
                <dt className="text-[var(--muted-foreground)]">Name</dt>
                <dd>{booking.customerName}</dd>
              </>
            )}
            <dt className="text-[var(--muted-foreground)]">Date</dt>
            <dd>{dateStr}</dd>
            {booking.startTime && (
              <>
                <dt className="text-[var(--muted-foreground)]">Start time</dt>
                <dd>{booking.startTime}</dd>
              </>
            )}
            {booking.durationHours !== null && (
              <>
                <dt className="text-[var(--muted-foreground)]">Duration</dt>
                <dd>
                  {booking.durationHours}{" "}
                  {booking.durationHours === 1 ? "hour" : "hours"}
                </dd>
              </>
            )}
            {(booking.venueName || booking.venueCity) && (
              <>
                <dt className="text-[var(--muted-foreground)]">Venue</dt>
                <dd>
                  {[booking.venueName, booking.venueCity]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </>
            )}
          </dl>
        </div>
      </section>

      {lineItems.length > 0 && (
        <section className="space-y-1">
          <h2 className="font-medium text-sm text-[var(--muted-foreground)] uppercase tracking-wide">
            Services
          </h2>
          <div className="rounded-md border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="px-4 py-2 text-left font-medium text-[var(--muted-foreground)]">
                    Service
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-[var(--muted-foreground)]">
                    Qty
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-[var(--muted-foreground)] hidden sm:table-cell">
                    Unit price
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-[var(--muted-foreground)]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-[var(--muted-foreground)] text-xs mt-0.5">
                          {item.description}
                        </div>
                      )}
                      {item.priceType === "hourly" &&
                        item.hoursInMinutes !== null && (
                          <div className="text-[var(--muted-foreground)] text-xs mt-0.5">
                            {(item.hoursInMinutes / 60)
                              .toFixed(2)
                              .replace(/\.?0+$/, "")}
                            h @ {chf.format(item.unitPrice)}/h
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-[var(--muted-foreground)]">
                      {chf.format(item.unitPrice)}
                      {item.priceType === "hourly" ? "/h" : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {chf.format(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border)] bg-[var(--muted)]">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Grand total
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {chf.format(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {booking.status === "offered" && (
        <section className="space-y-4">
          {showReconfirmBanner && (
            <div className="rounded-md border border-[var(--border)] bg-amber-50 dark:bg-amber-900/30 p-4">
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">
                This offer was updated since you accepted.
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-300 text-sm">
                Please review the revised details above and re-confirm your
                acceptance.
              </p>
            </div>
          )}
          <h2 className="font-medium text-sm text-[var(--muted-foreground)] uppercase tracking-wide">
            Accept offer
          </h2>
          <p className="text-sm">
            Review the details above, then accept the offer below. Once
            accepted, our team will be in touch to confirm next steps.
          </p>
          <AcceptForm
            token={token}
            bookingId={booking.id}
            offerVersion={booking.offerVersion}
          />
          <div className="pt-2">
            <DeclineForm token={token} />
          </div>
        </section>
      )}

      {booking.status === "accepted" && (
        <section>
          <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-6 text-center space-y-2">
            <p className="font-semibold text-lg">Offer accepted</p>
            <p className="text-[var(--muted-foreground)] text-sm">
              {booking.acceptedAt
                ? `Accepted on ${format(booking.acceptedAt, "d MMMM yyyy")}.`
                : "Your offer has been confirmed."}{" "}
              We'll be in touch with the final details.
            </p>
          </div>
        </section>
      )}

      {(booking.status === "rejected" || booking.status === "cancelled") && (
        <section>
          <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-6 text-center space-y-2">
            <p className="font-semibold text-lg">
              This offer is no longer available
            </p>
            <p className="text-[var(--muted-foreground)] text-sm">
              If you have questions, contact us at{" "}
              <a
                href="mailto:info@wardrobe-assistants.ch"
                className="underline hover:no-underline"
              >
                info@wardrobe-assistants.ch
              </a>
              .
            </p>
          </div>
        </section>
      )}

      {booking.status === "created" && (
        <section>
          <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-6 text-center">
            <p className="text-[var(--muted-foreground)] text-sm">
              This offer is not yet ready. Please check back later.
            </p>
          </div>
        </section>
      )}

      {booking.status === "offered" && (
        <p className="text-[var(--muted-foreground)] text-xs">
          Booking reference: {booking.id} · Offer v{booking.offerVersion}
        </p>
      )}
    </div>
  );
}
