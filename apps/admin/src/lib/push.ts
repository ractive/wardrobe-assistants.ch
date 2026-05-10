import { pushSubscriptions } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { env } from "./env";

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  url?: string;
};

/**
 * Send a push notification to all subscribed devices for a given user.
 *
 * Returns the number of successful sends. Stale subscriptions (404/410) are
 * deleted inline — first failed send is when we learn a subscription is dead.
 * One bad device does not block the rest.
 *
 * Short-circuits (no-op + warn) when VAPID env vars are missing, mirroring
 * the RESEND_API_KEY dev-fallback pattern in lib/email.ts.
 */
export async function sendPush(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number }> {
  const { vapidPublicKey, vapidPrivateKey, vapidSubject } = env;

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    if (env.nodeEnv === "development") {
      console.log(
        "[push] VAPID env vars unset — skipping push send (dev mode)",
      );
    } else {
      console.warn("[push] VAPID env vars unset — push notifications disabled");
    }
    return { sent: 0 };
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return { sent: 0 };

  // Lazy import so tests can mock 'web-push' without the module loading
  // during module initialisation (before vi.mock() takes effect).
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // Sum a per-subscription boolean after Promise.all rather than mutating a
  // shared counter inside the map — concurrent ++ can lose increments.
  const results = await Promise.all(
    subs.map(async (s): Promise<boolean> => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        return true;
      } catch (err: unknown) {
        const statusCode =
          err !== null &&
          typeof err === "object" &&
          "statusCode" in err &&
          typeof (err as { statusCode: unknown }).statusCode === "number"
            ? (err as { statusCode: number }).statusCode
            : undefined;

        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or gone — delete and move on.
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, s.endpoint));
        } else {
          console.error("[push] sendNotification failed for endpoint", {
            endpoint: s.endpoint.slice(0, 60),
            statusCode,
          });
        }
        return false;
      }
    }),
  );

  const sent = results.filter(Boolean).length;
  return { sent };
}
