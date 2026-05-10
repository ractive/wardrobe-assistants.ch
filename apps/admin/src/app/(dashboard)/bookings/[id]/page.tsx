import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NoPermissionCard } from "@/components/NoPermissionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { AssigneesPicker } from "@/features/bookings/components/AssigneesPicker";
import { BookingDetailActions } from "@/features/bookings/components/BookingDetailActions";
import { PendingRequestsPanel } from "@/features/bookings/components/PendingRequestsPanel";
import {
  getBookingById,
  listAssignableUsers,
} from "@/features/bookings/server/queries";
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

  const [canAssign, canDelete, canMessage, canApproveRequests] =
    await Promise.all([
      userHasPermission("BOOKING_ASSIGN"),
      userHasPermission("BOOKING_DELETE"),
      userHasPermission("BOOKING_MESSAGE_ASSIGNED"),
      userHasPermission("BOOKING_APPROVE_REQUEST"),
    ]);
  const candidates = canAssign ? await listAssignableUsers() : [];

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
      {booking.notes ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="font-medium text-sm">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{booking.notes}</p>
        </div>
      ) : null}
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
