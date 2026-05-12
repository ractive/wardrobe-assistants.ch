"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ShareWithCustomersProps {
  bookingRequestUrl: string;
}

export function ShareWithCustomers({
  bookingRequestUrl,
}: ShareWithCustomersProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookingRequestUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="text-lg font-medium">Share with customers</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Send this link to customers so they can submit a booking request.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-xs">
          {bookingRequestUrl}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy booking-request URL"}
          className="shrink-0"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          <span className="ml-1">{copied ? "Copied" : "Copy link"}</span>
        </Button>
      </div>
    </div>
  );
}
