"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (defaultAction === null || dismissed) return null;

  const confirmIsPrimary = defaultAction === "confirm";

  async function handle(action: "confirm" | "decline") {
    setIsProcessing(true);
    try {
      const fn = action === "confirm" ? confirmAssignment : declineAssignment;
      const result = await fn({ bookingId });
      if (result.error) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setDismissed(true);
      // Strip the ?action= query param now that the action is complete.
      router.replace(pathname);
    } finally {
      setIsProcessing(false);
    }
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
          disabled={isProcessing}
          onClick={() => handle("confirm")}
        >
          Confirm
        </Button>
        <Button
          type="button"
          variant={confirmIsPrimary ? "outline" : "default"}
          disabled={isProcessing}
          onClick={() => handle("decline")}
        >
          Decline
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isProcessing}
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
