"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BookingDetail } from "../schema";
import { EditBookingDialog } from "./BookingDialog";
import { DeleteBookingConfirm } from "./DeleteBookingConfirm";
import { MessageAssigneesDialog } from "./MessageAssigneesDialog";

export function BookingDetailActions({
  booking,
  canDelete,
  canMessage,
}: {
  booking: BookingDetail;
  canDelete: boolean;
  canMessage: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  // Terminal statuses are guarded server-side in updateBooking — disable
  // the trigger here so admins don't open a dialog that can't submit.
  // Every field present in the form is also rendered on the detail page,
  // so disabling Edit doesn't hide any information.
  // A.1: hide ALL lifecycle actions (Edit, Message assignees) on terminal status.
  // Delete stays visible so admins can still purge bad rows.
  const isClosed =
    booking.status === "rejected" || booking.status === "cancelled";

  const submittedAgo = formatDistanceToNow(booking.createdAt, {
    addSuffix: true,
  });
  const updatedAgo = formatDistanceToNow(booking.updatedAt, {
    addSuffix: true,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {/* A.1: Edit and Message hidden on terminal status */}
        {!isClosed && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
        )}
        {canMessage && !isClosed ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setMessageOpen(true)}
            disabled={booking.assignees.length === 0}
          >
            Message assignees
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        ) : null}
      </div>

      {/* A.2: createdAt / updatedAt muted footer */}
      <p className="text-[var(--muted-foreground)] text-xs">
        <span title={booking.createdAt.toISOString()}>
          Submitted {submittedAgo}
        </span>
        {" · "}
        <span title={booking.updatedAt.toISOString()}>
          last updated {updatedAgo}
        </span>
      </p>

      <EditBookingDialog
        defaults={{
          bookingId: booking.id,
          name: booking.name,
          date: booking.date,
          venue: booking.venue,
          notes: booking.notes,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          startTime: booking.startTime,
          durationHours: booking.durationHours,
          venueName: booking.venueName,
          venueCity: booking.venueCity,
          comment: booking.comment,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <MessageAssigneesDialog
        bookingId={booking.id}
        bookingName={booking.name}
        assigneesCount={booking.assignees.length}
        open={messageOpen}
        onOpenChange={setMessageOpen}
      />
      <DeleteBookingConfirm
        bookingId={booking.id}
        bookingName={booking.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/bookings")}
      />
    </div>
  );
}
