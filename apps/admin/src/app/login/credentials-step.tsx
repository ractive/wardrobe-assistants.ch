"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { type CredentialsInput, credentialsSchema } from "@/lib/login-schema";

type Props = {
  onSuccess: (next: "totp" | "done") => void;
};

export function CredentialsStep({ onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CredentialsInput>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: CredentialsInput) {
    setServerError(null);
    try {
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
        onSuccess("totp");
        return;
      }
      onSuccess("done");
    } catch {
      setServerError("Network error. Please try again.");
    }
  }

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className="h-11 w-full md:h-9"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  className="h-11 w-full md:h-9"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="text-destructive text-sm"
          >
            {serverError}
          </div>
        ) : null}
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-11 w-full md:h-9 md:w-auto"
        >
          {form.formState.isSubmitting ? "Signing in…" : "Continue"}
        </Button>
      </form>
    </Form>
  );
}
