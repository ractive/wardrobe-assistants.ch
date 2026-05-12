"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, startOfToday } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type CreateBookingInput,
  createBookingInput,
  editBookingFormInput,
} from "../schema";
import { createBooking, updateBooking } from "../server/actions";

export interface EditDefaults {
  bookingId: string;
  name: string;
  date: Date;
  venue: string;
  notes: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  startTime?: string | null;
  durationHours?: number | null;
  city?: string | null;
  comment?: string | null;
}

type Props =
  | { mode: "create"; defaults?: undefined; onSuccess?: () => void }
  | { mode: "edit"; defaults: EditDefaults; onSuccess?: () => void };

// While the user fills in the form, `date` may be undefined; the resolver
// rejects submit if the user never picks one. This typed form-value shape
// replaces the previous `undefined as unknown as Date` cast.
type FormValues = {
  name: string;
  date: Date | undefined;
  venue: string;
  notes?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  startTime?: string;
  durationHours?: number;
  city?: string;
  comment?: string;
};

// iter-37 §C.1–C.5: create and edit modes use different schemas.
// Create: future-only date (via Calendar disabled prop), 5h min duration,
//         startTime/durationHours/city required, email validated.
// Edit:   no date restriction (admins fix typos on past bookings), relaxed
//         duration (min 1 so legacy sub-5h rows can still be edited).
export function BookingForm(props: Props) {
  const isEdit = props.mode === "edit";
  const defaults = isEdit ? props.defaults : undefined;
  const router = useRouter();

  // Pick schema by mode so validation rules differ cleanly.
  // Edit uses editBookingFormInput (updateBookingInput without bookingId — the
  // form never renders a bookingId input; it's injected via closure in the
  // action dispatch). Create uses createBookingInput with strict required fields.
  const schema = isEdit ? editBookingFormInput : createBookingInput;

  const form = useForm<FormValues>({
    // `as never` suppresses the RHF/Zod generic mismatch between FormValues
    // (date optional mid-edit) and the schema's inferred output (date required).
    // The resolver enforces the constraint at runtime.
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: defaults?.name ?? "",
      date: defaults?.date,
      venue: defaults?.venue ?? "",
      notes: defaults?.notes ?? "",
      customerName: defaults?.customerName ?? "",
      customerEmail: defaults?.customerEmail ?? "",
      customerPhone: defaults?.customerPhone ?? "",
      startTime: defaults?.startTime ?? "",
      durationHours: defaults?.durationHours ?? undefined,
      city: defaults?.city ?? "",
      comment: defaults?.comment ?? "",
    },
  });

  const fallbackErrorMessage = isEdit
    ? "Could not update booking."
    : "Could not create booking.";

  const [state, actionDispatch] = useActionState(
    async (
      _prevState: { error?: unknown; message?: string } | null,
      data: CreateBookingInput,
    ) =>
      defaults
        ? updateBooking({ ...data, bookingId: defaults.bookingId })
        : createBooking(data),
    null,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally fires only when state changes; router/form/props are stable references that do not need to trigger re-runs
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
  }, [state, fallbackErrorMessage, isEdit]);

  // The resolver guarantees a real Date when handleSubmit fires, so parsing
  // is just the type-safe boundary — narrows `FormValues` (date optional) to
  // `CreateBookingInput` (date required) at runtime instead of via cast.
  const onSubmit = form.handleSubmit((data) =>
    actionDispatch(schema.parse(data) as CreateBookingInput),
  );

  const submitLabel = isEdit ? "Save changes" : "Create booking";

  return (
    <Form {...form}>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
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

        {/* iter-37 §C.4: When fieldset (date, time, duration) */}
        <fieldset className="space-y-3 rounded-md border border-[var(--border)] p-4">
          <legend className="px-1 text-sm font-medium">When</legend>
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-[var(--muted-foreground)]",
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value
                          ? format(field.value, "yyyy-MM-dd")
                          : "Pick a date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {/* iter-37 §C.1: future-only in create mode; edit is unrestricted
                        so admins can fix typos on past bookings. */}
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(d) => field.onChange(d)}
                      disabled={!isEdit ? (d) => d < startOfToday() : undefined}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Start time (HH:MM)
                    {!isEdit && (
                      <span
                        className="ml-1 text-[var(--destructive)]"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 19:30"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="durationHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Duration (hours)
                    {!isEdit && (
                      <span
                        className="ml-1 text-[var(--destructive)]"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    {/* iter-37 §C.2: min=5 for new bookings; min=1 for edits so
                        admins can fix legacy rows without being blocked. */}
                    <Input
                      type="number"
                      min={isEdit ? 1 : 5}
                      max={24}
                      placeholder={isEdit ? "e.g. 4" : "e.g. 8"}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        {/* iter-37 §C.4: Where fieldset (venue, city) */}
        <fieldset className="space-y-3 rounded-md border border-[var(--border)] p-4">
          <legend className="px-1 text-sm font-medium">Where</legend>
          <FormField
            control={form.control}
            name="venue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Venue</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  City
                  {!isEdit && (
                    <span
                      className="ml-1 text-[var(--destructive)]"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="space-y-3 rounded-md border border-[var(--border)] p-4">
          <legend className="px-1 text-sm font-medium">
            Customer contact (optional)
          </legend>
          <FormField
            control={form.control}
            name="customerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="customerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    {/* iter-37 §C.5: email validated by zod schema on both create/edit. */}
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer comment (optional)</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {/* RHF's isSubmitting tracks the awaited useActionState dispatch
              (its returned promise resolves when the server action settles). */}
          {form.formState.isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
