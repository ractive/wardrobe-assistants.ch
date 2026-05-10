"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PendingRequest } from "../schema";
import { approveRequest, rejectRequest } from "../server/actions";

interface PendingRequestsPanelProps {
  eventId: string;
  pendingRequests: PendingRequest[];
}

export function PendingRequestsPanel({
  eventId,
  pendingRequests,
}: PendingRequestsPanelProps) {
  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="font-medium text-sm">
        Pending requests ({pendingRequests.length})
      </h2>
      <ul
        className="mt-3 flex flex-col gap-3"
        aria-label="Pending participation requests"
      >
        {pendingRequests.map((req) => (
          <PendingRequestRow key={req.userId} eventId={eventId} request={req} />
        ))}
      </ul>
    </div>
  );
}

function PendingRequestRow({
  eventId,
  request,
}: {
  eventId: string;
  request: PendingRequest;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      try {
        const result = await approveRequest({
          eventId,
          userId: request.userId,
        });
        if (result.error) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      try {
        const result = await rejectRequest({
          eventId,
          userId: request.userId,
        });
        if (result.error) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="text-sm">
        <p className="font-medium">{request.displayName}</p>
        <p className="text-[var(--muted-foreground)]">{request.email}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
          aria-label={`Approve ${request.displayName}'s request`}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isPending}
          aria-label={`Reject ${request.displayName}'s request`}
        >
          Reject
        </Button>
      </div>
    </li>
  );
}
