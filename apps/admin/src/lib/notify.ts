import { user } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { sendTemplated } from "./email";
import type { ParamsFor } from "./email-templates";
import { pushPayload as bookingAssignedPushPayload } from "./email-templates/booking-assigned";
import { pushPayload as bookingBroadcastPushPayload } from "./email-templates/booking-broadcast";
import { pushPayload as bookingCancelledPushPayload } from "./email-templates/booking-cancelled";
import { pushPayload as participationRequestedPushPayload } from "./email-templates/participation-requested";
import { pushPayload as userDirectMessagePushPayload } from "./email-templates/user-direct-message";
import { sendPush } from "./push";

// Templates for which push is meaningful. Excludes:
//   - userInvited: recipient has no account / subscription yet
//   - passwordReset, verifyEmail: transactional — email only
export type NotifiableTemplateKey =
  | "bookingAssigned"
  | "bookingBroadcast"
  | "bookingCancelled"
  | "participationRequested"
  | "userDirectMessage";

// Map each notifiable template key to its push payload builder.
// Generic over K so callers cannot pair a key with mismatched params.
function pushPayloadFor<K extends NotifiableTemplateKey>(
  key: K,
  params: ParamsFor<K>,
) {
  switch (key) {
    case "bookingAssigned":
      return bookingAssignedPushPayload(params as ParamsFor<"bookingAssigned">);
    case "bookingBroadcast":
      return bookingBroadcastPushPayload(
        params as ParamsFor<"bookingBroadcast">,
      );
    case "bookingCancelled":
      return bookingCancelledPushPayload(
        params as ParamsFor<"bookingCancelled">,
      );
    case "participationRequested":
      return participationRequestedPushPayload(
        params as ParamsFor<"participationRequested">,
      );
    case "userDirectMessage":
      return userDirectMessagePushPayload(
        params as ParamsFor<"userDirectMessage">,
      );
  }
}

/**
 * Single cross-channel notification entry point for iter-23 notifiable triggers.
 *
 * Always fires both email and push per the iter-23 decision: push for immediacy,
 * email for durability. A failure in one channel is logged but does not block
 * the other — Promise.allSettled guarantees both run regardless.
 *
 * Throws AggregateError when *both* channels fail so callers can surface a
 * "notification failed" message. A single-channel failure is logged and
 * resolves successfully (the other channel still got through).
 */
export async function notifyUser<K extends NotifiableTemplateKey>(
  userId: string,
  templateKey: K,
  params: ParamsFor<K>,
): Promise<void> {
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const recipient = rows[0];
  if (!recipient) return;

  const [emailResult, pushResult] = await Promise.allSettled([
    sendTemplated(templateKey, recipient.email, params),
    sendPush(userId, pushPayloadFor(templateKey, params)),
  ]);

  if (emailResult.status === "rejected") {
    console.error("[notify] email channel failed", {
      userId,
      templateKey,
      err: emailResult.reason,
    });
  }
  if (pushResult.status === "rejected") {
    console.error("[notify] push channel failed", {
      userId,
      templateKey,
      err: pushResult.reason,
    });
  }

  if (emailResult.status === "rejected" && pushResult.status === "rejected") {
    throw new AggregateError(
      [emailResult.reason, pushResult.reason],
      `[notify] both channels failed for ${templateKey}`,
    );
  }
}
