"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const schema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
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

  const form = useForm<FormValues>({
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
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
                    {...field}
                  />
                </FormControl>
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
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverError ? (
            <p className="text-[var(--destructive)] text-sm" role="alert">
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
    <main className="mx-auto max-w-md px-6 py-12">
      <Suspense
        fallback={<p className="text-[var(--muted-foreground)]">Loading…</p>}
      >
        <SetPasswordInner />
      </Suspense>
    </main>
  );
}
