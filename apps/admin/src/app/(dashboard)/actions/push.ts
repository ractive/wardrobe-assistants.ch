"use server";

import { pushSubscriptions } from "@wardrobe-assistants/db/schema";
import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { getCachedSession } from "@/lib/auth";
import { db } from "@/lib/db";

export type PushSubscribeInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

/**
 * Persist a new push subscription for the authenticated user.
 * Upserts by endpoint — re-subscribing from the same browser updates
 * the row rather than creating a duplicate.
 */
export async function subscribePush(
  input: PushSubscribeInput,
): Promise<{ success: boolean }> {
  const session = await getCachedSession();
  if (!session) return { success: false };

  const now = new Date();
  await db
    .insert(pushSubscriptions)
    .values({
      id: ulid(),
      userId: session.user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent ?? null,
      createdAt: now,
      lastUsedAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: session.user.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
        lastUsedAt: now,
      },
    });

  return { success: true };
}

/**
 * Remove a push subscription for the authenticated user.
 * Scoped to the current user so one user can't delete another's subscription.
 */
export async function unsubscribePush(
  endpoint: string,
): Promise<{ success: boolean }> {
  const session = await getCachedSession();
  if (!session) return { success: false };

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );

  return { success: true };
}
