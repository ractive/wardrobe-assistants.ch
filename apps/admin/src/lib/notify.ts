import { user, userProfile } from "@wardrobe-assistants/db/schema";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { sendTemplated } from "./email";
import type { ParamsFor } from "./email-templates";
import { pushPayload as assignmentConfirmedPushPayload } from "./email-templates/assignment-confirmed";
import { pushPayload as assignmentDeclinedPushPayload } from "./email-templates/assignment-declined";
import { pushPayload as assignmentInvitePushPayload } from "./email-templates/assignment-invite";
import { pushPayload as assignmentWithdrawnPushPayload } from "./email-templates/assignment-withdrawn";
import { pushPayload as bookingBroadcastPushPayload } from "./email-templates/booking-broadcast";
import { pushPayload as bookingCancelledPushPayload } from "./email-templates/booking-cancelled";
import { pushPayload as bookingRequestedPushPayload } from "./email-templates/booking-requested";
import { pushPayload as offerAcceptedPushPayload } from "./email-templates/offer-accepted";
import { pushPayload as offerRejectedPushPayload } from "./email-templates/offer-rejected";
import { pushPayload as participationRequestedPushPayload } from "./email-templates/participation-requested";
import { pushPayload as userDirectMessagePushPayload } from "./email-templates/user-direct-message";
import { sendPush } from "./push";

// Templates for which push is meaningful. Excludes:
//   - userInvited: recipient has no account / subscription yet
//   - passwordReset, verifyEmail: transactional — email only
//   - bookingRequestReceived: customer-side autoreply, no user account
//   - offerSent, offerRevised: customer has no user account / push subscription
//   - offerAcceptedAdmin: customer email-only (no user account)
export type NotifiableTemplateKey =
  | "assignmentConfirmed"
  | "assignmentDeclined"
  | "assignmentInvite"
  | "assignmentWithdrawn"
  | "bookingBroadcast"
  | "bookingCancelled"
  | "bookingRequested"
  | "offerAccepted"
  | "offerRejected"
  | "participationRequested"
  | "userDirectMessage";

// Map each notifiable template key to its push payload builder.
// Generic over K so callers cannot pair a key with mismatched params.
function pushPayloadFor<K extends NotifiableTemplateKey>(
  key: K,
  params: ParamsFor<K>,
) {
  switch (key) {
    case "assignmentConfirmed":
      return assignmentConfirmedPushPayload(
        params as ParamsFor<"assignmentConfirmed">,
      );
    case "assignmentDeclined":
      return assignmentDeclinedPushPayload(
        params as ParamsFor<"assignmentDeclined">,
      );
    case "assignmentInvite":
      return assignmentInvitePushPayload(
        params as ParamsFor<"assignmentInvite">,
      );
    case "assignmentWithdrawn":
      return assignmentWithdrawnPushPayload(
        params as ParamsFor<"assignmentWithdrawn">,
      );
    case "bookingBroadcast":
      return bookingBroadcastPushPayload(
        params as ParamsFor<"bookingBroadcast">,
      );
    case "bookingCancelled":
      return bookingCancelledPushPayload(
        params as ParamsFor<"bookingCancelled">,
      );
    case "bookingRequested":
      return bookingRequestedPushPayload(
        params as ParamsFor<"bookingRequested">,
      );
    case "offerAccepted":
      return offerAcceptedPushPayload(params as ParamsFor<"offerAccepted">);
    case "offerRejected":
      return offerRejectedPushPayload(params as ParamsFor<"offerRejected">);
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

/**
 * Fan out a single notification to every verified ADMIN. Each admin receives
 * both push and email per `notifyUser`. `Promise.allSettled` so one bad
 * recipient does not drop notifications for the rest. Errors from the inner
 * `notifyUser` calls are logged by `notifyUser` itself.
 */
export async function notifyAdmins<K extends NotifiableTemplateKey>(
  templateKey: K,
  params: ParamsFor<K>,
): Promise<void> {
  const admins = await db
    .select({ id: userProfile.userId })
    .from(userProfile)
    .where(
      and(eq(userProfile.role, "ADMIN"), eq(userProfile.status, "verified")),
    );
  await Promise.allSettled(
    admins.map((a) => notifyUser(a.id, templateKey, params)),
  );
}
