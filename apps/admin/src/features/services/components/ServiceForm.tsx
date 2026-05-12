"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type CreateServiceInput,
  PRICE_TYPES,
  type ServiceInput,
  serviceInput,
} from "../schema";
import { createService, updateService } from "../server/actions";

const PRICE_TYPE_LABEL: Record<(typeof PRICE_TYPES)[number], string> = {
  fixed: "Fixed",
  hourly: "Hourly",
};

interface EditDefaults {
  serviceId: string;
  name: string;
  description: string;
  priceType: (typeof PRICE_TYPES)[number];
  price: number;
}

type Props =
  | { mode: "create"; defaults?: undefined; onSuccess?: () => void }
  | { mode: "edit"; defaults: EditDefaults; onSuccess?: () => void };

export function ServiceForm(props: Props) {
  const isEdit = props.mode === "edit";
  const defaults = isEdit ? props.defaults : undefined;
  const router = useRouter();

  const form = useForm({
    // `as never` suppresses the RHF/Zod generic mismatch: zodResolver's inferred
    // output type conflicts with useForm's generic when the schema has branded/union
    // types; the resolver enforces the correct shape at runtime.
    resolver: zodResolver(serviceInput) as never,
    defaultValues: {
      name: defaults?.name ?? "",
      description: defaults?.description ?? "",
      priceType: defaults?.priceType ?? ("fixed" as const),
      price: defaults?.price ?? 0,
    },
  });

  const fallbackErrorMessage = isEdit
    ? "Could not update service."
    : "Could not create service.";

  const [state, actionDispatch] = useActionState(
    async (
      _prevState: { error?: unknown; message?: string } | null,
      data: CreateServiceInput,
    ) =>
      defaults
        ? updateService({ ...data, serviceId: defaults.serviceId })
        : createService(data),
    null,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally fires only when state changes; router/form/props.onSuccess are stable references that do not need to trigger re-runs
  useEffect(() => {
    if (!state) return;
    if (state.error) {
      toast.error(state.message ?? fallbackErrorMessage);
    } else {
      toast.success(state.message ?? "Done.");
      if (!isEdit) form.reset();
      props.onSuccess?.();
      router.refresh();
    }
  }, [state]);

  const onSubmit = form.handleSubmit((data) =>
    actionDispatch(serviceInput.parse(data)),
  );

  const submitLabel = isEdit ? "Save changes" : "Create service";
  const formError = form.formState.errors.root?.message;

  return (
    <Form {...form}>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        {formError ? (
          <p className="text-[var(--destructive)] text-sm" role="alert">
            {formError}
          </p>
        ) : null}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="priceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price type</FormLabel>
              <FormControl>
                <fieldset
                  className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                  aria-label="Price type"
                >
                  {PRICE_TYPES.map((t) => (
                    <label
                      key={t}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        name={field.name}
                        value={t}
                        checked={field.value === t}
                        onChange={() => field.onChange(t)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <span>{PRICE_TYPE_LABEL[t]}</span>
                    </label>
                  ))}
                </fieldset>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => {
            const { value, onChange, ...rest } = field;
            return (
              <FormItem>
                <FormLabel>Price (CHF, whole numbers only)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    autoComplete="off"
                    value={
                      value === 0 || value === undefined || value === null
                        ? ""
                        : String(value)
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange(v === "" ? Number.NaN : Number(v));
                    }}
                    {...rest}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {/* isSubmitting reflects RHF's async handleSubmit state — correct here
              because the form uses react-hook-form, not a native action attribute */}
          {form.formState.isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}

// Suppress unused-import diag for the type alias if linters care.
export type { ServiceInput };
