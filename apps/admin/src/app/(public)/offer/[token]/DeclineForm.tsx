"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { rejectOffer } from "./actions";

// iter-28: "Decline this offer" link → modal with optional reason → rejectOffer.
export function DeclineForm({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function onDecline() {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await rejectOffer(token, reason.trim() || undefined);
        if (result.error) {
          setServerError(result.message);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setServerError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[var(--muted-foreground)] text-sm underline hover:no-underline"
      >
        Decline this offer
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isPending && !next) return;
          if (!next) {
            setServerError(null);
            setReason("");
          }
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this offer?</DialogTitle>
            <DialogDescription>
              Let us know you'd like to decline. You may optionally share a
              reason — we'll use it to improve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="decline-reason"
              className="text-sm font-medium leading-none"
            >
              Reason (optional)
            </label>
            <Textarea
              id="decline-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Date no longer works"
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
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDecline}
              disabled={isPending}
            >
              {isPending ? "Declining…" : "Decline offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
