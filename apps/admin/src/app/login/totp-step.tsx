"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
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
import { type TotpInput, totpSchema } from "@/lib/login-schema";

type Props = {
  onSuccess: () => void;
};

export function TotpStep({ onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<TotpInput>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: "" },
  });

  // F-FE-11: when this step mounts (i.e. on credentials → totp transition),
  // move keyboard focus into the code input so the user can keep typing
  // without grabbing the mouse. The ref is wired into the rendered input
  // via Controller's render-prop below.
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

  async function onSubmit(values: TotpInput) {
    setServerError(null);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: values.code,
      });
      if (error) {
        setServerError(error.message ?? "Invalid code");
        return;
      }
      onSuccess();
    } catch {
      setServerError("Network error. Please try again.");
    }
  }

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        method="post"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Authentication code</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-11 w-full tracking-widest md:h-9"
                  {...field}
                  ref={(el) => {
                    field.ref(el);
                    codeInputRef.current = el;
                  }}
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
          {form.formState.isSubmitting ? "Verifying…" : "Verify"}
        </Button>
      </form>
    </Form>
  );
}
