"use server";

import { services } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ulid } from "ulid";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { withPermission } from "@/lib/permissions";
import {
  type ActionResult,
  type ArchiveServiceInput,
  archiveServiceInput,
  type CreateServiceInput,
  createServiceInput,
  type UpdateServiceInput,
  updateServiceInput,
} from "../schema";

export const createService = withPermission(
  "SERVICE_CREATE",
  async (actorId, raw: CreateServiceInput): Promise<ActionResult> => {
    const parsed = createServiceInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;
    const now = new Date();
    const id = ulid();
    await db.insert(services).values({
      id,
      name: input.name,
      description: input.description,
      priceType: input.priceType,
      price: input.price,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit({
      actorUserId: actorId,
      action: "service.create",
      targetType: "service",
      targetId: id,
    });
    revalidatePath("/services");
    return { error: false, message: "Service created." };
  },
);

export const updateService = withPermission(
  "SERVICE_CREATE",
  async (actorId, raw: UpdateServiceInput): Promise<ActionResult> => {
    const parsed = updateServiceInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;
    const updated = await db
      .update(services)
      .set({
        name: input.name,
        description: input.description,
        priceType: input.priceType,
        price: input.price,
        updatedAt: new Date(),
      })
      .where(eq(services.id, input.serviceId))
      .returning({ id: services.id });
    if (updated.length === 0) {
      return { error: true, message: "Service not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "service.update",
      targetType: "service",
      targetId: input.serviceId,
    });
    revalidatePath("/services");
    return { error: false, message: "Service updated." };
  },
);

export const archiveService = withPermission(
  "SERVICE_DELETE",
  async (actorId, raw: ArchiveServiceInput): Promise<ActionResult> => {
    const parsed = archiveServiceInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    // Soft delete only — historical event line items reference services
    // informationally; archive retires the catalog entry without breaking
    // history. iter-22 line items snapshot name/price at billing time.
    const archived = await db
      .update(services)
      .set({ archived: true, updatedAt: new Date() })
      .where(eq(services.id, parsed.data.serviceId))
      .returning({ id: services.id });
    if (archived.length === 0) {
      return { error: true, message: "Service not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "service.archive",
      targetType: "service",
      targetId: parsed.data.serviceId,
    });
    revalidatePath("/services");
    return { error: false, message: "Service archived." };
  },
);
