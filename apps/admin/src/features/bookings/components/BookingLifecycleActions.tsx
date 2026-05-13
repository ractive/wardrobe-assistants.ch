"use client";

import { Info } from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  adminAcceptOffer,
  cancelBooking,
  rejectBooking,
  sendOffer,
  sendRevisedOffer,
} from "../server/actions";

// ---------------------------------------------------------------------------
// A.6: Contextual helper copy per lifecycle status
// ---------------------------------------------------------------------------

const STATUS_HELPER: Record<string, string> = {
  created: "This booking is new. Send offer to email the customer the quote.",
  offered: "Offer sent. Waiting for the customer to accept.",
  accepted: "Customer accepted. Assign squad members to dispatch the work.",
};

// ---------------------------------------------------------------------------
// A.1 / §E: (i) icon rendered as a standalone focusable button beside the
// action button. The Tooltip is triggered from this icon only — not from the
// whole action button — so the action button's own hover/focus styles are
// unaffected. The icon button carries an aria-label; the action button copy
// is not duplicated here.
// ---------------------------------------------------------------------------

function InfoTrigger({ label }: { label: string }) {
  return (
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={label}
        className="ml-1.5 inline-flex shrink-0 cursor-default items-center opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <Info aria-hidden="true" className="size-3.5" />
      </button>
    </TooltipTrigger>
  );
}

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
  customerEmail,
  open,
  onOpenChange,
}: {
  bookingId: string;
  /** Customer email — shown in the confirmation copy if present. */
  customerEmail: string | null;
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
            This will move the booking to a terminal state. This can't be
            undone.
          </DialogDescription>
        </DialogHeader>
        {customerEmail && (
          <p className="text-sm">
            The customer at <span className="font-medium">{customerEmail}</span>{" "}
            will be notified by email.
          </p>
        )}
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
            {squadMemberNames.length > 0
              ? `This will notify ${squadMemberNames.length} squad ${squadMemberNames.length === 1 ? "member" : "members"} and email the customer. This can't be undone.`
              : "This will email the customer. This can't be undone."}
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

  const helperText = STATUS_HELPER[status];

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Action buttons — 2-col grid on narrow screens, wrapping row on wider.
            Each button has an inline (i) icon; a Tooltip reveals the hint on
            hover and keyboard focus. Clicking the button opens the action
            dialog — the icon is decorative and does not intercept clicks. */}
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {showSendOffer && (
              <Tooltip>
                {/* §E: button and (i) icon are siblings. TooltipTrigger wraps
                    only the icon so the tooltip fires from the icon, not the
                    full button. */}
                <span className="inline-flex items-center">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      setSendOfferOpen(true);
                    }}
                    disabled={selectionCount === 0}
                  >
                    Send offer
                  </Button>
                  <InfoTrigger label="Info: Send offer" />
                </span>
                <TooltipContent side="top" className="max-w-xs">
                  {selectionCount === 0
                    ? "Add line items before sending the offer."
                    : "Snapshots the current line items and emails the offer to the customer. The booking moves to 'offered' status."}
                </TooltipContent>
              </Tooltip>
            )}
            {showSendRevised && (
              <Tooltip>
                <span className="inline-flex items-center">
                  <Button
                    type="button"
                    variant={status === "accepted" ? "destructive" : "default"}
                    onClick={() => setSendRevisedOpen(true)}
                  >
                    Send revised offer
                  </Button>
                  <InfoTrigger label="Info: Send revised offer" />
                </span>
                <TooltipContent side="top" className="max-w-xs">
                  Emails an updated quote to the customer. If the booking is
                  already accepted, the customer must re-confirm. Status returns
                  to &apos;offered&apos;.
                </TooltipContent>
              </Tooltip>
            )}
            {showAccept && (
              <Tooltip>
                <span className="inline-flex items-center">
                  <Button
                    type="button"
                    variant={status === "offered" ? "outline" : "default"}
                    onClick={() => setAcceptOpen(true)}
                  >
                    {status === "offered"
                      ? "Accept on customer's behalf"
                      : "Accept booking"}
                  </Button>
                  <InfoTrigger
                    label={
                      status === "offered"
                        ? "Info: Accept on customer's behalf"
                        : "Info: Accept booking"
                    }
                  />
                </span>
                <TooltipContent side="top" className="max-w-xs">
                  Marks the booking as accepted. Use when the customer confirms
                  outside the offer link (e.g. by phone). Status moves to
                  &apos;accepted&apos;.
                </TooltipContent>
              </Tooltip>
            )}
            {showReject && (
              <Tooltip>
                <span className="inline-flex items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject booking
                  </Button>
                  <InfoTrigger label="Info: Reject booking" />
                </span>
                <TooltipContent side="top" className="max-w-xs">
                  Declines the booking request and emails the customer. This is
                  a terminal action and cannot be undone.
                </TooltipContent>
              </Tooltip>
            )}
            {showCancel && (
              <Tooltip>
                <span className="inline-flex items-center">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel booking
                  </Button>
                  <InfoTrigger label="Info: Cancel booking" />
                </span>
                <TooltipContent side="top" className="max-w-xs">
                  Cancels the accepted booking, notifies all assigned squad
                  members via push + email, and emails the customer. This is a
                  terminal action and cannot be undone.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>

        {/* A.6: contextual helper line, one sentence per non-terminal status */}
        {helperText && (
          <p className="text-[var(--muted-foreground)] text-sm">{helperText}</p>
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
        customerEmail={customerEmail}
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
