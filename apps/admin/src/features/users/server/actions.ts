"use server";

import { randomBytes } from "node:crypto";
import { user, userProfile } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { withPermission } from "@/lib/permissions";
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

export const inviteUser = withPermission(
  "USER_INVITE",
  async (_actorId, raw: InviteUserInput): Promise<ActionResult> => {
    const parsed = inviteUserInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;

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
      const message =
        err instanceof Error ? err.message : "Failed to create user profile.";
      return { error: true, message };
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
      const detail = err instanceof Error ? err.message : "unknown error";
      return {
        error: true,
        message: `User created, but invite email could not be sent: ${detail}. Resend the invite from the user list.`,
      };
    }

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
    return { error: false, message: "User deleted." };
  },
);

export const messageUser = withPermission(
  "USER_MESSAGE",
  async (_actorId, raw: MessageUserInput): Promise<ActionResult> => {
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
      await sendEmail({
        to: target.email,
        subject: input.subject,
        text: input.body,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown error";
      return { error: true, message: `Message could not be sent: ${detail}` };
    }
    return { error: false, message: "Message sent." };
  },
);
