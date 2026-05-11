// iter-31: shared input schema for the public booking-request flow. Both the
// admin route handler (`apps/admin/src/app/api/public/booking-requests/route.ts`)
// and the homepage form (`apps/homepage/src/app/(site)/booking-request/_form.tsx`)
// import from here so client and server agree on the validated shape at compile
// time.
//
// This file intentionally contains NO server-only imports. The spam-defense
// fields (`formLoadedAt`, `honeypot`, `token`) live exclusively in the admin
// route handler — they are not customer-visible and must not appear in the
// client-side schema.
import { z } from "zod";

export const bookingRequestInputSchema = z
  .object({
    customerName: z.string().trim().min(1, "Name is required.").max(200),
    customerEmail: z
      .string()
      .trim()
      .email("Please enter a valid email address.")
      .max(200),
    customerPhone: z
      .string()
      .trim()
      .regex(
        /^(?=(?:\D*\d){7,})\+?[0-9 ./()-]{7,20}$/,
        "Please enter a phone number with at least 7 digits.",
      ),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date."),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please enter a valid start time."),
    durationHours: z
      .number({ message: "Please enter a duration." })
      .int()
      .min(5, "Minimum duty is 5 hours.")
      .max(24, "Maximum duration is 24 hours."),
    venueName: z.string().trim().min(1, "Venue name is required.").max(200),
    venueCity: z.string().trim().min(1, "City is required.").max(200),
    serviceSelections: z
      .array(
        z.object({
          serviceId: z.string().min(1).max(64),
          quantity: z.number().int().positive().max(10_000),
        }),
      )
      .max(50),
    comment: z.string().max(2000).optional(),
  })
  .refine(
    (data) =>
      data.serviceSelections.length > 0 ||
      (data.comment != null && data.comment.trim().length > 0),
    {
      message:
        "Tell us which services you need, or describe your request in 'Anything else?'.",
      path: ["serviceSelections"],
    },
  );

export type BookingRequestInput = z.infer<typeof bookingRequestInputSchema>;
