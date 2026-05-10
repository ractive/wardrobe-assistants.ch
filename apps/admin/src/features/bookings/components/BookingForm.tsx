"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUSES,
  type CreateBookingInput,
  createBookingInput,
} from "../schema";
import { createBooking, updateBooking } from "../server/actions";

const STATUS_LABEL: Record<(typeof BOOKING_STATUSES)[number], string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
  done: "Done",
};

interface EditDefaults {
  bookingId: string;
  name: string;
  date: Date;
  venue: string;
  notes: string | null;
  status: (typeof BOOKING_STATUSES)[number];
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
  status: (typeof BOOKING_STATUSES)[number];
};

// Both modes drive the same set of input fields. We use the create input
// schema for client validation and pass the bookingId through closure when in
// edit mode — keeps the form a single component without `any` gymnastics.
export function BookingForm(props: Props) {
  const isEdit = props.mode === "edit";
  const defaults = isEdit ? props.defaults : undefined;

  const form = useForm({
    // Resolver enforces the parsed `CreateBookingInput` shape (date required)
    // even though the form-state type permits `date: undefined` mid-edit.
    resolver: zodResolver(createBookingInput) as never,
    defaultValues: {
      name: defaults?.name ?? "",
      date: defaults?.date,
      venue: defaults?.venue ?? "",
      notes: defaults?.notes ?? "",
      status: defaults?.status ?? "draft",
    },
  });

  const submit = useFormAction(
    async (data: CreateBookingInput) =>
      defaults
        ? updateBooking({ ...data, bookingId: defaults.bookingId })
        : createBooking(data),
    {
      onSuccess: () => {
        if (!isEdit) form.reset();
        props.onSuccess?.();
      },
      fallbackErrorMessage: isEdit
        ? "Could not update booking."
        : "Could not create booking.",
    },
  );

  // The resolver guarantees a real Date when handleSubmit fires, so parsing
  // is just the type-safe boundary — narrows `FormValues` (date optional) to
  // `CreateBookingInput` (date required) at runtime instead of via cast.
  const onSubmit = form.handleSubmit((data) =>
    submit(createBookingInput.parse(data)),
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(d) => field.onChange(d)}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
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
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BOOKING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
