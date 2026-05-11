"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  confirmAssignment,
  declineAssignment,
} from "../server/assignment-actions";

type Props = {
  bookingId: string;
  defaultAction: "confirm" | "decline" | null;
};

export function AssignmentActionPrompt({ bookingId, defaultAction }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (defaultAction === null || dismissed) return null;

  const confirmIsPrimary = defaultAction === "confirm";

  function handle(action: "confirm" | "decline") {
    startTransition(async () => {
      const fn = action === "confirm" ? confirmAssignment : declineAssignment;
      const result = await fn({ bookingId });
      if (result.error) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setDismissed(true);
    });
  }

  return (
    <Card
      className="border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
      role="region"
      aria-label="Action required"
    >
      <p className="font-medium text-amber-900 text-base dark:text-amber-100">
        {confirmIsPrimary
          ? "Confirm this assignment?"
          : "Decline this assignment?"}
      </p>
      <p className="mt-1 text-amber-800 text-sm dark:text-amber-200">
        You can change your mind from the buttons below later.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={confirmIsPrimary ? "default" : "outline"}
          disabled={pending}
          onClick={() => handle("confirm")}
        >
          Confirm
        </Button>
        <Button
          type="button"
          variant={confirmIsPrimary ? "outline" : "default"}
          disabled={pending}
          onClick={() => handle("decline")}
        >
          Decline
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
