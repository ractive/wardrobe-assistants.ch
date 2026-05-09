"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-8 md:px-0 md:py-12">
      <h1 className="font-semibold text-2xl md:text-3xl">
        Something went wrong
      </h1>
      <p className="text-[var(--muted-foreground)] text-sm md:text-base">
        We couldn&apos;t load this page. Try again, and if the problem persists
        contact an admin.
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
