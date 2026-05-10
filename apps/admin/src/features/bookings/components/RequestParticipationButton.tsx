"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestParticipation } from "../server/actions";

interface RequestParticipationButtonProps {
  bookingId: string;
}

export function RequestParticipationButton({
  bookingId,
}: RequestParticipationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await requestParticipation({ bookingId });
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
    <Button
      onClick={handleClick}
      disabled={isPending}
      size="sm"
      className="w-full md:w-auto"
    >
      {isPending ? "Requesting…" : "Request to participate"}
    </Button>
  );
}
