"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BrandBadge } from "@/components/BrandBadge";
import { CredentialsStep } from "./credentials-step";
import { TotpStep } from "./totp-step";

type Step = "credentials" | "totp";

/**
 * Validate that a returnTo value is safe for same-origin redirect.
 * Mirror of the proxy.ts validator — keeps the client-side check consistent.
 */
function validateReturnTo(value: string | null): string {
  if (!value) return "/";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://") ||
    /^javascript:/iu.test(value)
  ) {
    return "/";
  }
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("credentials");

  const returnTo = useMemo(
    () => validateReturnTo(searchParams.get("returnTo")),
    [searchParams],
  );

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="sr-only">Admin sign in</h1>
        <BrandBadge />
        <main>
          <p
            className="mb-8 text-muted-foreground text-sm"
            aria-live="polite"
            // The two prompts are short enough that announcing the swap to SR
            // users is the cheapest way to confirm "you're now on step 2".
          >
            {step === "credentials"
              ? "Use your admin email and password."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
          {step === "credentials" ? (
            <CredentialsStep
              onSuccess={(next) => {
                if (next === "totp") {
                  setStep("totp");
                  return;
                }
                router.replace(returnTo);
              }}
            />
          ) : (
            <TotpStep onSuccess={() => router.replace(returnTo)} />
          )}
        </main>
      </div>
    </div>
  );
}
