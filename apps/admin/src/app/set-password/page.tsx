"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandBadge } from "@/components/BrandBadge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// iter-16f / C-SEC-15: 12-char floor matched to login-schema.ts. Length
// over complexity rules (NIST SP 800-63B).
const schema = z
  .object({
    newPassword: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <>
        <h1 className="font-semibold text-2xl">Invalid link</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          This invite link is missing its token. Ask the admin to resend the
          invitation.
        </p>
      </>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await authClient.resetPassword({
      newPassword: values.newPassword,
      token,
    });
    if (error) {
      setServerError(
        error.message ??
          "Could not set your password. The link may be expired.",
      );
      return;
    }
    router.replace("/login?invited=1");
  });

  return (
    <>
      <h1 className="font-semibold text-2xl">Set your password</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Pick a password to finish setting up your Wardrobe Assistants admin
        account.
      </p>
      <Form {...form}>
        <form method="post" onSubmit={onSubmit} className="mt-6 space-y-4">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    suppressHydrationWarning
                    {...field}
                  />
                </FormControl>
                <p className="text-[var(--muted-foreground)] text-sm">
                  Use a passphrase you don&apos;t reuse — at least 12
                  characters.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    suppressHydrationWarning
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverError ? (
            <p role="alert" className="text-[var(--destructive)] text-sm">
              {serverError}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Setting password…" : "Set password"}
          </Button>
        </form>
      </Form>
    </>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <BrandBadge />
        <main>
          <Suspense
            fallback={<p className="text-muted-foreground">Loading…</p>}
          >
            <SetPasswordInner />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
