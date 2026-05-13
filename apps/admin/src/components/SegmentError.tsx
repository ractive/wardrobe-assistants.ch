"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface SegmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SegmentError({ error, reset }: SegmentErrorProps) {
  useEffect(() => {
    // iter-42 §B: one readable line for triage. Digest pairs with the
    // server-side onRequestError log (instrumentation.ts).
    const digest = error.digest ?? "no-digest";
    console.error(
      `error: client boundary digest=${digest} ${error.message}`,
      error,
    );
  }, [error]);

  return (
    <section className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-8 md:px-0 md:py-12">
      <h2 className="font-semibold text-2xl md:text-3xl">
        Something went wrong
      </h2>
      <p className="text-[var(--muted-foreground)] text-sm md:text-base">
        We couldn’t load this section. Try again, and if the problem persists
        contact an admin.
      </p>
      {error.digest ? (
        <p className="font-mono text-[var(--muted-foreground)] text-xs">
          Error ID: {error.digest}
        </p>
      ) : null}
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
