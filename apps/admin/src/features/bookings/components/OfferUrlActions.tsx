"use client";

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface OfferUrlActionsProps {
  offerToken: string;
  baseUrl: string;
}

export function OfferUrlActions({ offerToken, baseUrl }: OfferUrlActionsProps) {
  const offerUrl = `${baseUrl}/offer/${offerToken}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(offerUrl);
      toast.success("Offer link copied to clipboard.");
    } catch {
      toast.error(
        "Couldn't copy the offer link. Try copying the URL manually.",
      );
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleCopy()}
      >
        <Copy aria-hidden="true" className="size-4" />
        Copy offer link
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a
          href={offerUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View offer as customer (opens in a new tab)"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          View as customer
        </a>
      </Button>
    </div>
  );
}
