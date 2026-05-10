import { z } from "zod";

export const PRICE_TYPES = ["fixed", "hourly"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

const priceField = z
  .number({ message: "Price must be a number" })
  .int("Price must be a whole CHF amount")
  .positive("Price must be greater than 0");

export const serviceInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(10_000),
  priceType: z.enum(PRICE_TYPES, { message: "Choose a price type" }),
  price: priceField,
});
export type ServiceInput = z.infer<typeof serviceInput>;

export const createServiceInput = serviceInput;
export type CreateServiceInput = ServiceInput;

export const updateServiceInput = serviceInput.extend({
  serviceId: z.string().min(1),
});
export type UpdateServiceInput = z.infer<typeof updateServiceInput>;

export const archiveServiceInput = z.object({
  serviceId: z.string().min(1),
});
export type ArchiveServiceInput = z.infer<typeof archiveServiceInput>;

export const serviceListItem = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  priceType: z.enum(PRICE_TYPES),
  price: z.number().int().positive(),
  archived: z.boolean(),
  createdAt: z.date(),
  // Type-contract pattern (kb/admin-architecture/data-layer.md): UI never
  // reads raw `price` in JSX — only `priceFormatted`. Computed in the query
  // layer via `formatChf`.
  priceFormatted: z.string(),
});
export type ServiceListItem = z.infer<typeof serviceListItem>;

export const actionResult = z.discriminatedUnion("error", [
  z.object({ error: z.literal(false), message: z.string() }),
  z.object({ error: z.literal(true), message: z.string() }),
]);
export type ActionResult = z.infer<typeof actionResult>;
