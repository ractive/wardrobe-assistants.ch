// iter-34 §6: shared Zod schema for the public services catalog response.
// Both the admin route handler (`apps/admin/src/app/api/public/services/route.ts`)
// and the homepage build-time fetch (`apps/homepage/src/app/(site)/booking-request/page.tsx`)
// import from here so they agree on the wire shape at runtime.
//
// `price` is a whole-CHF integer matching `services.price` in the DB — no
// centimes anywhere in the wire format (see iter-26).
import { z } from "zod";

export const publicServiceEntrySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1),
  description: z.string().nullable(),
  priceType: z.enum(["fixed", "hourly"]),
  price: z.number().int().nonnegative(),
});

export const publicServicesResponseSchema = z.object({
  services: z.array(publicServiceEntrySchema),
});

export type PublicServiceEntry = z.infer<typeof publicServiceEntrySchema>;
export type PublicServicesResponse = z.infer<
  typeof publicServicesResponseSchema
>;
