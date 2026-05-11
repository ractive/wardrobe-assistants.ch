"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  confirmAssignment,
  declineAssignment,
} from "../server/assignment-actions";

type Props = {
  bookingId: string;
  status: "assigned" | "confirmed" | "rejected" | "withdrawn";
};

// Inline confirm/decline/re-confirm depending on current assignment state.
// Hidden when the assignment has no inverse action available.
export function AssignmentInlineActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  async function call(action: "confirm" | "decline") {
    setIsProcessing(true);
    try {
      const fn = action === "confirm" ? confirmAssignment : declineAssignment;
      const result = await fn({ bookingId });
      if (result.error) toast.error(result.message);
      else {
        toast.success(result.message);
        router.refresh();
      }
    } finally {
      setIsProcessing(false);
    }
  }

  if (status === "assigned") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button disabled={isProcessing} onClick={() => call("confirm")}>
          Confirm
        </Button>
        <Button
          variant="outline"
          disabled={isProcessing}
          onClick={() => call("decline")}
        >
          Decline
        </Button>
      </div>
    );
  }
  if (status === "confirmed") {
    return (
      <Button
        variant="outline"
        disabled={isProcessing}
        onClick={() => call("decline")}
      >
        Decline
      </Button>
    );
  }
  if (status === "rejected" || status === "withdrawn") {
    return (
      <Button disabled={isProcessing} onClick={() => call("confirm")}>
        Confirm again
      </Button>
    );
  }
  return null;
}
