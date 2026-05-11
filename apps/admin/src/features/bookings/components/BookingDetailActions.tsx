"use client";

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

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
        Edit
      </Button>
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
