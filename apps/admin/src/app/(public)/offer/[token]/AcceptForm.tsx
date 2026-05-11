"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptOffer } from "./actions";

export function AcceptForm({
  token,
  bookingId,
  offerVersion,
}: {
  token: string;
  bookingId: string;
  offerVersion: number;
}) {
  const router = useRouter();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const mailtoSubject = encodeURIComponent(
    `Question about booking ${bookingId} (offer v${offerVersion})`,
  );
  const mailtoBody = encodeURIComponent(
    `Hi,\n\nI have a question about offer v${offerVersion} for booking ${bookingId}:\n\n`,
  );
  const mailtoHref = `mailto:info@wardrobe-assistants.ch?subject=${mailtoSubject}&body=${mailtoBody}`;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await acceptOffer(token, agreedToTerms);
        if (result.error) {
          setServerError(result.message);
          return;
        }
        router.refresh();
      } catch {
        setServerError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
            disabled={isPending}
          />
          <label
            htmlFor="terms"
            className="cursor-pointer text-sm leading-relaxed"
          >
            I agree to the terms and conditions and confirm that the details
            above are correct.
          </label>
        </div>
        {serverError ? (
          <p className="text-[var(--destructive)] text-sm" role="alert">
            {serverError}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={isPending || !agreedToTerms}
          className="w-full sm:w-auto"
        >
          {isPending ? "Accepting…" : "Accept offer"}
        </Button>
      </form>
      <p className="text-[var(--muted-foreground)] text-sm">
        Not ready to accept?{" "}
        <a href={mailtoHref} className="underline hover:no-underline">
          I have questions
        </a>
      </p>
    </div>
  );
}
