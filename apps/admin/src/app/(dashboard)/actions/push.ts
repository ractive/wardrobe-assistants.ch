"use server";

import { pushSubscriptions } from "@wardrobe-assistants/db/schema";
import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { z } from "zod";
import { getCachedSession } from "@/lib/auth";
import { db } from "@/lib/db";

const pushSubscribeInputSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  userAgent: z.string().max(1024).optional(),
});

const endpointSchema = z.string().url().max(2048);

export type PushSubscribeInput = z.infer<typeof pushSubscribeInputSchema>;

/**
 * Persist a new push subscription for the authenticated user.
 *
 * Idempotent for the same (user, endpoint) pair — re-subscribing from the
 * same browser updates the row rather than creating a duplicate. We do NOT
 * upsert by endpoint alone: that would let a second user "claim" another
 * user's endpoint and silently steal their pushes. Instead, when an endpoint
 * already exists for a different user we delete the stale row first (the
 * old browser would have hit 404/410 next push anyway and been pruned).
 */
export async function subscribePush(
  input: PushSubscribeInput,
): Promise<{ success: boolean }> {
  const parsed = pushSubscribeInputSchema.safeParse(input);
  if (!parsed.success) return { success: false };

  const session = await getCachedSession();
  if (!session) return { success: false };

  const data = parsed.data;
  const now = new Date();
  try {
    // Drop any existing row for this endpoint owned by another user before
    // inserting — prevents subscription takeover via the unique-endpoint
    // upsert path.
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, data.endpoint));

    await db.insert(pushSubscriptions).values({
      id: ulid(),
      userId: session.user.id,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      userAgent: data.userAgent ?? null,
      createdAt: now,
      lastUsedAt: now,
    });
    return { success: true };
  } catch (err) {
    console.error("[push] subscribe failed", err);
    return { success: false };
  }
}

/**
 * Remove a push subscription for the authenticated user.
 * Scoped to the current user so one user can't delete another's subscription.
 */
export async function unsubscribePush(
  endpoint: string,
): Promise<{ success: boolean }> {
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return { success: false };

  const session = await getCachedSession();
  if (!session) return { success: false };

  try {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.endpoint, parsed.data),
        ),
      );
    return { success: true };
  } catch (err) {
    console.error("[push] unsubscribe failed", err);
    return { success: false };
  }
}
