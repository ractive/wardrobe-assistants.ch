"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface SegmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SegmentError({ error, reset }: SegmentErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-8 md:px-0 md:py-12">
      <h2 className="font-semibold text-2xl md:text-3xl">
        Something went wrong
      </h2>
      <p className="text-[var(--muted-foreground)] text-sm md:text-base">
        {error.message
          ? error.message
          : "We couldn’t load this section. Try again, and if the problem persists contact an admin."}
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
