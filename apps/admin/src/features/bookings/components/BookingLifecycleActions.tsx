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
  sendOffer,
  sendRevisedOffer,
} from "../server/actions";

// ---------------------------------------------------------------------------
// Send offer dialog
// ---------------------------------------------------------------------------

export function SendOfferDialog({
  bookingId,
  customerEmail,
  totalFormatted,
  open,
  onOpenChange,
}: {
  bookingId: string;
  customerEmail: string | null;
  totalFormatted: string;
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
        const result = await sendOffer({ bookingId });
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
          err instanceof Error ? err.message : "Could not send offer.";
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
        if (!next) setServerError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send offer?</DialogTitle>
          <DialogDescription>
            This will snapshot the current line items and email the offer to the
            customer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          {customerEmail ? (
            <p>
              <span className="text-[var(--muted-foreground)]">To: </span>
              {customerEmail}
            </p>
          ) : (
            <p className="text-[var(--destructive)]">
              No customer email on file — the offer will be sent without
              notifying the customer.
            </p>
          )}
          <p>
            <span className="text-[var(--muted-foreground)]">Total: </span>
            {totalFormatted}
          </p>
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
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Sending…" : "Send offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Send revised offer dialog
// ---------------------------------------------------------------------------

export function SendRevisedOfferDialog({
  bookingId,
  status,
  customerEmail,
  totalFormatted,
  open,
  onOpenChange,
}: {
  bookingId: string;
  status: string;
  customerEmail: string | null;
  totalFormatted: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isAccepted = status === "accepted";

  function onConfirm() {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await sendRevisedOffer({ bookingId });
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
          err instanceof Error ? err.message : "Could not send revised offer.";
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
        if (!next) setServerError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send revised offer?</DialogTitle>
          <DialogDescription>
            This will snapshot the current line items as a new offer version and
            email the customer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          {isAccepted && (
            <p className="text-[var(--destructive)] font-medium text-sm">
              Warning: This will clear the customer's acceptance and require
              them to re-confirm.
            </p>
          )}
          {customerEmail ? (
            <p>
              <span className="text-[var(--muted-foreground)]">To: </span>
              {customerEmail}
            </p>
          ) : (
            <p className="text-[var(--destructive)]">
              No customer email on file — the revised offer will be sent without
              notifying the customer.
            </p>
          )}
          <p>
            <span className="text-[var(--muted-foreground)]">Total: </span>
            {totalFormatted}
          </p>
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
            variant={isAccepted ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Sending…" : "Send revised offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
        if (!next) {
          setServerError(null);
          setReason("");
        }
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
  squadMemberNames,
  open,
  onOpenChange,
}: {
  bookingId: string;
  /** Names of squad members who will be notified (assigned + confirmed). */
  squadMemberNames: string[];
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
        if (!next) {
          setServerError(null);
          setReason("");
        }
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
        {squadMemberNames.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">Squad members who will be notified:</p>
            <ul className="mt-1 list-disc list-inside text-[var(--muted-foreground)]">
              {squadMemberNames.map((name, idx) => (
                // Display names can collide (e.g. two members sharing a
                // nickname); index is stable for this render-only list.
                // biome-ignore lint/suspicious/noArrayIndexKey: render-only list
                <li key={idx}>{name}</li>
              ))}
            </ul>
          </div>
        )}
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
  canSendOffer,
  canAccept,
  canReject,
  canCancel,
  customerEmail,
  selectionCount,
  lineItemsTotal,
  squadMemberNames,
}: {
  bookingId: string;
  status: string;
  canSendOffer: boolean;
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
  customerEmail: string | null;
  selectionCount: number;
  lineItemsTotal: number;
  /** Names of active squad members (for cancel confirmation modal). */
  squadMemberNames: string[];
}) {
  const [sendOfferOpen, setSendOfferOpen] = useState(false);
  const [sendRevisedOpen, setSendRevisedOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // A.1: hide ALL lifecycle actions on terminal statuses.
  const isTerminal = status === "cancelled" || status === "rejected";

  const showSendOffer = canSendOffer && status === "created" && !isTerminal;
  // iter-28: "Send revised offer" visible for offered/accepted with ≥1 line item.
  const showSendRevised =
    canSendOffer &&
    (status === "offered" || status === "accepted") &&
    selectionCount > 0 &&
    !isTerminal;
  const showAccept =
    canAccept && (status === "created" || status === "offered") && !isTerminal;
  // iter-28: reject also works from offered state.
  const showReject =
    canReject && (status === "created" || status === "offered") && !isTerminal;
  const showCancel = canCancel && status === "accepted" && !isTerminal;

  if (
    !showSendOffer &&
    !showSendRevised &&
    !showAccept &&
    !showReject &&
    !showCancel
  )
    return null;

  const totalFormatted = `CHF ${lineItemsTotal.toLocaleString("en-CH")}.-`;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showSendOffer && (
          <Button
            type="button"
            variant="default"
            onClick={() => setSendOfferOpen(true)}
            disabled={selectionCount === 0}
            title={
              selectionCount === 0
                ? "Add line items before sending the offer"
                : undefined
            }
          >
            Send offer
          </Button>
        )}
        {showSendRevised && (
          <Button
            type="button"
            variant={status === "accepted" ? "destructive" : "default"}
            onClick={() => setSendRevisedOpen(true)}
          >
            Send revised offer
          </Button>
        )}
        {showAccept && (
          <Button
            type="button"
            variant={status === "offered" ? "outline" : "default"}
            onClick={() => setAcceptOpen(true)}
          >
            {status === "offered"
              ? "Accept on customer's behalf"
              : "Accept booking"}
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
      <SendOfferDialog
        bookingId={bookingId}
        customerEmail={customerEmail}
        totalFormatted={totalFormatted}
        open={sendOfferOpen}
        onOpenChange={setSendOfferOpen}
      />
      <SendRevisedOfferDialog
        bookingId={bookingId}
        status={status}
        customerEmail={customerEmail}
        totalFormatted={totalFormatted}
        open={sendRevisedOpen}
        onOpenChange={setSendRevisedOpen}
      />
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
        squadMemberNames={squadMemberNames}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
