"use client";

import { useTransition } from "react";
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
  const [pending, startTransition] = useTransition();

  function call(action: "confirm" | "decline") {
    startTransition(async () => {
      const fn = action === "confirm" ? confirmAssignment : declineAssignment;
      const result = await fn({ bookingId });
      if (result.error) toast.error(result.message);
      else toast.success(result.message);
    });
  }

  if (status === "assigned") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => call("confirm")}>
          Confirm
        </Button>
        <Button
          variant="outline"
          disabled={pending}
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
        disabled={pending}
        onClick={() => call("decline")}
      >
        Decline
      </Button>
    );
  }
  if (status === "rejected" || status === "withdrawn") {
    return (
      <Button disabled={pending} onClick={() => call("confirm")}>
        Confirm again
      </Button>
    );
  }
  return null;
}
