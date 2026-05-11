"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { withdrawAssignment } from "../server/assignment-actions";

type Props = { bookingId: string };

const MAX_REASON = 500;

export function WithdrawAssignmentDialog({ bookingId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await withdrawAssignment({
        bookingId,
        reason: reason.trim() || undefined,
      });
      if (result.error) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Withdraw assignment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw from this booking?</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900 text-sm dark:border-red-700 dark:bg-red-950/40 dark:text-red-100">
            Admins will be notified. They'll need to reassign someone else.
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="withdraw-reason">
              Reason (optional, up to {MAX_REASON} characters)
            </Label>
            <Textarea
              id="withdraw-reason"
              maxLength={MAX_REASON}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Anything that helps admins reassign — illness, conflict, etc."
              rows={4}
            />
            <p
              className="text-[var(--muted-foreground)] text-xs"
              aria-live="polite"
            >
              {reason.length} / {MAX_REASON}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => {
                setOpen(false);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Withdrawing…" : "Withdraw"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
