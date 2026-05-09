"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { authClient } from "@/lib/auth-client";
import {
  type CredentialsInput,
  credentialsSchema,
  type TotpInput,
  totpSchema,
} from "@/lib/login-schema";

type Step = "credentials" | "totp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [serverError, setServerError] = useState<string | null>(null);

  const credentialsForm = useForm<CredentialsInput>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  const totpForm = useForm<TotpInput>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: "" },
  });

  async function onCredentials(values: CredentialsInput) {
    setServerError(null);
    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError(error.message ?? "Invalid email or password");
      return;
    }
    // twoFactorRedirect: true means TOTP enrollment is required to complete sign-in.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setStep("totp");
      return;
    }
    router.replace("/");
  }

  async function onTotp(values: TotpInput) {
    setServerError(null);
    const { error } = await authClient.twoFactor.verifyTotp({
      code: values.code,
    });
    if (error) {
      setServerError(error.message ?? "Invalid code");
      return;
    }
    router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="mb-1 font-semibold text-2xl">Admin sign in</h1>
      <p className="mb-8 text-[var(--muted-foreground)] text-sm">
        {step === "credentials"
          ? "Use your admin email and password."
          : "Enter the 6-digit code from your authenticator app."}
      </p>

      {step === "credentials" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={credentialsForm.handleSubmit(onCredentials)}
        >
          <label className="flex flex-col gap-2 text-sm">
            Email
            <input
              type="email"
              autoComplete="email"
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--ring)]"
              {...credentialsForm.register("email")}
            />
            {credentialsForm.formState.errors.email && (
              <span className="text-[var(--destructive)] text-xs">
                {credentialsForm.formState.errors.email.message}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Password
            <input
              type="password"
              autoComplete="current-password"
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--ring)]"
              {...credentialsForm.register("password")}
            />
            {credentialsForm.formState.errors.password && (
              <span className="text-[var(--destructive)] text-xs">
                {credentialsForm.formState.errors.password.message}
              </span>
            )}
          </label>
          {serverError ? (
            <p role="alert" className="text-[var(--destructive)] text-sm">
              {serverError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={credentialsForm.formState.isSubmitting}
            className="mt-2 rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-foreground)] text-sm disabled:opacity-60"
          >
            {credentialsForm.formState.isSubmitting
              ? "Signing in…"
              : "Continue"}
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={totpForm.handleSubmit(onTotp)}
        >
          <label className="flex flex-col gap-2 text-sm">
            Authentication code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm tracking-widest outline-none focus:border-[var(--ring)]"
              {...totpForm.register("code")}
            />
            {totpForm.formState.errors.code && (
              <span className="text-[var(--destructive)] text-xs">
                {totpForm.formState.errors.code.message}
              </span>
            )}
          </label>
          {serverError ? (
            <p role="alert" className="text-[var(--destructive)] text-sm">
              {serverError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={totpForm.formState.isSubmitting}
            className="mt-2 rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-foreground)] text-sm disabled:opacity-60"
          >
            {totpForm.formState.isSubmitting ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}
    </main>
  );
}
