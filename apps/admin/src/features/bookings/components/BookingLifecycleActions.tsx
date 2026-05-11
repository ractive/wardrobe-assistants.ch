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
import { Textarea } from "@/components/ui/textarea";
import {
  adminAcceptOffer,
  cancelBooking,
  rejectBooking,
} from "../server/actions";

// ---------------------------------------------------------------------------
// Accept booking dialog
// ---------------------------------------------------------------------------

export function AcceptBookingDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function onConfirm() {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await adminAcceptOffer({ bookingId });
        if (result.error) {
          setServerError(result.message);
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not accept booking.";
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
          <DialogTitle>Accept booking?</DialogTitle>
          <DialogDescription>
            Mark this booking as accepted. This confirms the booking is going
            ahead.
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
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Accepting…" : "Accept booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Reject booking dialog
// ---------------------------------------------------------------------------

export function RejectBookingDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function onConfirm() {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await rejectBooking({
          bookingId,
          reason: reason.trim() || undefined,
        });
        if (result.error) {
          setServerError(result.message);
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not reject booking.";
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
          <DialogTitle>Reject booking?</DialogTitle>
          <DialogDescription>
            Decline this booking request. You may optionally provide a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label
            htmlFor="reject-reason"
            className="text-sm font-medium leading-none"
          >
            Reason (optional)
          </label>
          <Textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Date unavailable"
            disabled={isPending}
          />
        </div>
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
            {isPending ? "Rejecting…" : "Reject booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Cancel booking dialog
// ---------------------------------------------------------------------------

export function CancelBookingDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function onConfirm() {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await cancelBooking({
          bookingId,
          reason: reason.trim() || undefined,
        });
        if (result.error) {
          setServerError(result.message);
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not cancel booking.";
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
          <DialogTitle>Cancel booking?</DialogTitle>
          <DialogDescription>
            Cancel this accepted booking. You may optionally provide a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label
            htmlFor="cancel-reason"
            className="text-sm font-medium leading-none"
          >
            Reason (optional)
          </label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Event postponed"
            disabled={isPending}
          />
        </div>
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
            Back
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Cancelling…" : "Cancel booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle action buttons (client wrapper so dialogs have local state)
// ---------------------------------------------------------------------------

export function BookingLifecycleButtons({
  bookingId,
  status,
  canAccept,
  canReject,
  canCancel,
}: {
  bookingId: string;
  status: string;
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
}) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const showAccept =
    canAccept && (status === "created" || status === "offered");
  const showReject = canReject && status === "created";
  const showCancel = canCancel && status === "accepted";

  if (!showAccept && !showReject && !showCancel) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showAccept && (
          <Button
            type="button"
            variant="default"
            onClick={() => setAcceptOpen(true)}
          >
            Accept booking
          </Button>
        )}
        {showReject && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setRejectOpen(true)}
          >
            Reject booking
          </Button>
        )}
        {showCancel && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setCancelOpen(true)}
          >
            Cancel booking
          </Button>
        )}
      </div>
      <AcceptBookingDialog
        bookingId={bookingId}
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
      />
      <RejectBookingDialog
        bookingId={bookingId}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
      />
      <CancelBookingDialog
        bookingId={bookingId}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
