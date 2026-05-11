"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const isClosed =
    booking.status === "rejected" || booking.status === "cancelled";

  const editButton = (
    <Button
      type="button"
      variant="outline"
      onClick={() => setEditOpen(true)}
      disabled={isClosed}
      aria-disabled={isClosed}
    >
      Edit
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {isClosed ? (
        <TooltipProvider>
          <Tooltip>
            {/* Wrap in a span so the tooltip has a hoverable target even
                when the underlying <button> is disabled (browsers swallow
                pointer events on disabled buttons). */}
            <TooltipTrigger asChild>
              <span>{editButton}</span>
            </TooltipTrigger>
            <TooltipContent>
              {booking.status === "cancelled"
                ? "Cancelled bookings can't be edited."
                : "Rejected bookings can't be edited."}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        editButton
      )}
      {canMessage ? (
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
