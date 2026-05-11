import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HasPermission } from "@/components/HasPermission";
import { NoPermissionCard } from "@/components/NoPermissionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssigneesPicker } from "@/features/bookings/components/AssigneesPicker";
import { BookingDetailActions } from "@/features/bookings/components/BookingDetailActions";
import { BookingLifecycleButtons } from "@/features/bookings/components/BookingLifecycleActions";
import {
  LineItemsEditor,
  LineItemsReadOnly,
  type ServiceOption,
} from "@/features/bookings/components/LineItemsEditor";
import { PendingRequestsPanel } from "@/features/bookings/components/PendingRequestsPanel";
import {
  getBookingById,
  listAssignableUsers,
} from "@/features/bookings/server/queries";
import { listServices } from "@/features/services/server/queries";
import { getCachedSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCachedSession();
  if (!session) redirect("/login");

  const canView = await userHasPermission("BOOKING_VIEW");
  if (!canView) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">Booking</h1>
        <NoPermissionCard />
      </section>
    );
  }

  const booking = await getBookingById(id);
  if (!booking) notFound();

  const [
    canAssign,
    canDelete,
    canMessage,
    canApproveRequests,
    canAccept,
    canReject,
    canCancel,
    canCreate,
  ] = await Promise.all([
    userHasPermission("BOOKING_ASSIGN"),
    userHasPermission("BOOKING_DELETE"),
    userHasPermission("BOOKING_MESSAGE_ASSIGNED"),
    userHasPermission("BOOKING_APPROVE_REQUEST"),
    userHasPermission("BOOKING_ACCEPT_MANUAL"),
    userHasPermission("BOOKING_REJECT"),
    userHasPermission("BOOKING_CANCEL"),
    userHasPermission("BOOKING_CREATE"),
  ]);

  const candidates = canAssign ? await listAssignableUsers() : [];

  // Services for line items editor — only loaded when admin has BOOKING_CREATE
  // and status='created'. Composed here (server component) to avoid the
  // cross-feature import restriction that blocks features/bookings from
  // importing features/services directly.
  let services: ServiceOption[] = [];
  if (canCreate && booking.status === "created") {
    try {
      const rows = await listServices({ includeArchived: false });
      services = rows.map((r) => ({
        id: r.id,
        name: r.name,
        priceType: r.priceType,
        price: r.price,
        priceFormatted: r.priceFormatted,
      }));
    } catch (err) {
      // Expected: SERVICE_VIEW permission not held by this role. Log other
      // errors (DB outage etc.) so they surface instead of silently hiding
      // the line-items editor.
      console.warn("Failed to load services for line items editor:", err);
    }
  }

  const isPublicRequest = booking.createdBy === null;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/bookings">
            <ArrowLeft className="size-4" aria-hidden="true" /> All bookings
          </Link>
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-semibold text-2xl md:text-3xl">
              {booking.name}
            </h1>
            <StatusBadge kind="booking" status={booking.status} />
            {isPublicRequest && (
              <Badge variant="outline">Public booking request</Badge>
            )}
          </div>
          <p className="text-[var(--muted-foreground)] text-sm">
            {format(booking.date, "EEEE, d MMMM yyyy")} · {booking.venue}
          </p>
        </div>
        <BookingDetailActions
          booking={booking}
          canDelete={canDelete}
          canMessage={canMessage}
        />
      </header>

      {/* Lifecycle action buttons — visible if any of accept/reject/cancel is
          held. `BookingLifecycleButtons` further hides individual buttons
          based on the per-action `can*` flags. */}
      {(canAccept || canReject || canCancel) && (
        <BookingLifecycleButtons
          bookingId={booking.id}
          status={booking.status}
          canAccept={canAccept}
          canReject={canReject}
          canCancel={canCancel}
        />
      )}

      {/* Customer contact */}
      {(booking.customerName ||
        booking.customerEmail ||
        booking.customerPhone) && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="font-medium text-sm">Customer contact</h2>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {booking.customerName && (
              <>
                <dt className="text-[var(--muted-foreground)]">Name</dt>
                <dd>{booking.customerName}</dd>
              </>
            )}
            {booking.customerEmail && (
              <>
                <dt className="text-[var(--muted-foreground)]">Email</dt>
                <dd>
                  <a
                    href={`mailto:${booking.customerEmail}`}
                    className="hover:underline"
                  >
                    {booking.customerEmail}
                  </a>
                </dd>
              </>
            )}
            {booking.customerPhone && (
              <>
                <dt className="text-[var(--muted-foreground)]">Phone</dt>
                <dd>
                  <a
                    href={`tel:${booking.customerPhone}`}
                    className="hover:underline"
                  >
                    {booking.customerPhone}
                  </a>
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Schedule & venue details */}
      {(booking.startTime ||
        booking.durationHours ||
        booking.venueName ||
        booking.venueCity) && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="font-medium text-sm">Schedule &amp; venue</h2>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {booking.startTime && (
              <>
                <dt className="text-[var(--muted-foreground)]">Start time</dt>
                <dd>{booking.startTime}</dd>
              </>
            )}
            {booking.durationHours && (
              <>
                <dt className="text-[var(--muted-foreground)]">Duration</dt>
                <dd>
                  {booking.durationHours}{" "}
                  {booking.durationHours === 1 ? "hour" : "hours"}
                </dd>
              </>
            )}
            {booking.venueName && (
              <>
                <dt className="text-[var(--muted-foreground)]">Venue name</dt>
                <dd>{booking.venueName}</dd>
              </>
            )}
            {booking.venueCity && (
              <>
                <dt className="text-[var(--muted-foreground)]">City</dt>
                <dd>{booking.venueCity}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Notes */}
      {booking.notes ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="font-medium text-sm">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{booking.notes}</p>
        </div>
      ) : null}

      {/* Customer comment */}
      {booking.comment ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="font-medium text-sm">Customer comment</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{booking.comment}</p>
        </div>
      ) : null}

      {/* Line items */}
      {(canCreate && booking.status === "created") ||
      booking.selections.length > 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="font-medium text-sm">Line items</h2>
          <div className="mt-3">
            {canCreate && booking.status === "created" ? (
              <LineItemsEditor
                bookingId={booking.id}
                initialSelections={booking.selections}
                services={services}
                durationHours={booking.durationHours}
              />
            ) : (
              <LineItemsReadOnly selections={booking.selections} />
            )}
          </div>
        </div>
      ) : null}

      {/* Assignees */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium text-sm">
          Assignees ({booking.assignees.length})
        </h2>
        <div className="mt-3">
          {canAssign ? (
            <AssigneesPicker
              bookingId={booking.id}
              assignees={booking.assignees}
              candidates={candidates}
            />
          ) : booking.assignees.length === 0 ? (
            <p className="text-[var(--muted-foreground)] text-sm">
              No one assigned yet.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {booking.assignees.map((a) => (
                <li
                  key={a.userId}
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                >
                  {a.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {canApproveRequests && booking.pendingRequests.length > 0 && (
        <PendingRequestsPanel
          bookingId={booking.id}
          pendingRequests={booking.pendingRequests}
        />
      )}
    </section>
  );
}
