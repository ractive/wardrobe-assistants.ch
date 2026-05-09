"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteEvent } from "../server/actions";

export function DeleteEventConfirm({
  eventId,
  eventName,
  open,
  onOpenChange,
  onDeleted,
}: {
  eventId: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function onConfirm() {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await deleteEvent({ eventId });
        if (result.error) {
          setServerError(result.message);
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        onOpenChange(false);
        if (onDeleted) onDeleted();
        else router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not delete event.";
        setServerError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {eventName}?</DialogTitle>
          <DialogDescription>
            This permanently removes the event and all its assignments. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {serverError ? (
          <p className="text-[var(--destructive)] text-sm" role="alert">
            {serverError}
          </p>
        ) : null}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
