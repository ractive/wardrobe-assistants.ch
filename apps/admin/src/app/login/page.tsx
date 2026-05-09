"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CredentialsStep } from "./credentials-step";
import { TotpStep } from "./totp-step";

type Step = "credentials" | "totp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8 md:py-12">
      <h1 className="mb-1 font-semibold text-2xl md:text-3xl">Admin sign in</h1>
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
            router.replace("/");
          }}
        />
      ) : (
        <TotpStep onSuccess={() => router.replace("/")} />
      )}
    </main>
  );
}
