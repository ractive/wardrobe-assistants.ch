"use server";

import { randomBytes } from "node:crypto";
import { user, userProfile } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";
import { recordAudit } from "@/lib/audit-log";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTemplated } from "@/lib/email";
import { withPermission } from "@/lib/permissions";
import { consume, RATE_LIMITS } from "@/lib/rate-limit";
import {
  type ActionResult,
  type DeleteUserInput,
  deleteUserInput,
  type InviteUserInput,
  inviteUserInput,
  type MessageUserInput,
  messageUserInput,
} from "../schema";

function generateTempPassword(): string {
  return randomBytes(32).toString("base64url");
}

function nameForAuth(input: InviteUserInput): string {
  const nick = input.nickname?.trim();
  if (nick) return nick;
  return `${input.firstName} ${input.lastName}`.trim();
}

// iter-16f: error messages from these throw sites used to propagate to
// the user-facing toast via `useFormAction`'s catch path. Replace with
// generic strings + a correlation ID, and log the underlying error
// server-side. The `[ref ID]` lets support cross-reference an audit-log
// row.
function sanitizedFailure(
  scope: string,
  err: unknown,
  correlationId: string,
  fallback: string,
): ActionResult {
  console.error(`[${scope}] action failed`, { correlationId, err });
  return { error: true, message: `${fallback} (ref ${correlationId})` };
}

export const inviteUser = withPermission(
  "USER_INVITE",
  async (actorId, raw: InviteUserInput): Promise<ActionResult> => {
    const parsed = inviteUserInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;

    // iter-16f / C-SEC-02: cap invites per admin per hour.
    const rl = consume(`invite:${actorId}`, RATE_LIMITS.invite);
    if (!rl.allowed) {
      return {
        error: true,
        message: "Invite limit reached. Try again later.",
      };
    }

    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1);
    if (existing.length > 0) {
      return {
        error: true,
        message: "A user with that email already exists.",
      };
    }

    const password = generateTempPassword();
    const signUp = await auth.api.signUpEmail({
      body: {
        email: input.email,
        password,
        name: nameForAuth(input),
      },
      headers: new Headers(),
    });
    if (!signUp || !("user" in signUp)) {
      return { error: true, message: "Failed to create user account." };
    }

    try {
      await db.insert(userProfile).values({
        userId: signUp.user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        nickname: input.nickname ?? null,
        mobileNumber: input.mobileNumber ?? null,
        role: input.role,
        status: "invited",
        invitedAt: new Date(),
      });
    } catch (err) {
      // Best-effort cleanup so the auth user doesn't dangle without a profile.
      try {
        await db.delete(user).where(eq(user.id, signUp.user.id));
      } catch {
        // Swallow — primary failure is reported below.
      }
      const correlationId = await recordAudit({
        actorUserId: actorId,
        action: "user.invite",
        targetType: "user",
        targetId: signUp.user.id,
        metadata: { email: input.email, outcome: "profile_insert_failed" },
      });
      return sanitizedFailure(
        "users.inviteUser",
        err,
        correlationId,
        "Failed to create user profile.",
      );
    }

    // Triggers the BA reset-password flow; the email body is sent via the
    // sendResetPassword hook in lib/auth.ts. The user clicks the link, lands
    // on /set-password?token=…, sets a real password, and signs in.
    try {
      await auth.api.requestPasswordReset({
        body: { email: input.email, redirectTo: "/set-password" },
        headers: new Headers(),
      });
    } catch (err) {
      const correlationId = await recordAudit({
        actorUserId: actorId,
        action: "user.invite",
        targetType: "user",
        targetId: signUp.user.id,
        metadata: { email: input.email, outcome: "invite_email_failed" },
      });
      console.error("[users.inviteUser] invite email failed", {
        correlationId,
        err,
      });
      return {
        error: true,
        message: `User created, but invite email could not be sent. Resend the invite from the user list. (ref ${correlationId})`,
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "user.invite",
      targetType: "user",
      targetId: signUp.user.id,
      metadata: { email: input.email, role: input.role },
    });
    return { error: false, message: "Invitation sent." };
  },
);

export const deleteUser = withPermission(
  "USER_DELETE",
  async (actorId, raw: DeleteUserInput): Promise<ActionResult> => {
    const parsed = deleteUserInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    if (parsed.data.userId === actorId) {
      return { error: true, message: "You cannot delete your own account." };
    }
    // FK cascade on user_profile.user_id removes the profile row.
    const deleted = await db
      .delete(user)
      .where(eq(user.id, parsed.data.userId))
      .returning({ id: user.id });
    if (deleted.length === 0) {
      return { error: true, message: "User not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "user.delete",
      targetType: "user",
      targetId: parsed.data.userId,
    });
    return { error: false, message: "User deleted." };
  },
);

export const messageUser = withPermission(
  "USER_MESSAGE",
  async (actorId, raw: MessageUserInput): Promise<ActionResult> => {
    const parsed = messageUserInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;

    const rows = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    const target = rows[0];
    if (!target) {
      return { error: true, message: "User not found." };
    }

    try {
      await sendTemplated("userDirectMessage", target.email, {
        subject: input.subject,
        body: input.body,
      });
    } catch (err) {
      const correlationId = await recordAudit({
        actorUserId: actorId,
        action: "user.message",
        targetType: "user",
        targetId: input.userId,
        metadata: { outcome: "send_failed" },
      });
      return sanitizedFailure(
        "users.messageUser",
        err,
        correlationId,
        "Failed to send message.",
      );
    }
    await recordAudit({
      actorUserId: actorId,
      action: "user.message",
      targetType: "user",
      targetId: input.userId,
    });
    return { error: false, message: "Message sent." };
  },
);
