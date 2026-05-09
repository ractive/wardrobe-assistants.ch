"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EventDetail } from "../schema";
import { DeleteEventConfirm } from "./DeleteEventConfirm";
import { EditEventDialog } from "./EventDialog";
import { MessageAssigneesDialog } from "./MessageAssigneesDialog";

export function EventDetailActions({
  event,
  canDelete,
  canMessage,
}: {
  event: EventDetail;
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
          disabled={event.assignees.length === 0}
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
      <EditEventDialog
        defaults={{
          eventId: event.id,
          name: event.name,
          date: event.date,
          venue: event.venue,
          notes: event.notes,
          status: event.status,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <MessageAssigneesDialog
        eventId={event.id}
        eventName={event.name}
        assigneesCount={event.assignees.length}
        open={messageOpen}
        onOpenChange={setMessageOpen}
      />
      <DeleteEventConfirm
        eventId={event.id}
        eventName={event.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/events")}
      />
    </div>
  );
}
