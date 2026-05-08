import { schema, userProfile } from "@wardrobe-assistants/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "./db";
import { sendEmail } from "./email";
import { env } from "./env";
import type { Role } from "./permissions";

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  // Origin-scoped session cookies on admin.wardrobe-assistants.ch — XSS on
  // the homepage origin can't reach them.
  advanced: {
    defaultCookieAttributes: {
      secure: true,
      sameSite: "lax",
      httpOnly: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Wardrobe Assistants admin password",
        text: `Reset your password by visiting: ${url}`,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your Wardrobe Assistants admin email",
        text: `Verify your email by visiting: ${url}`,
      });
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: false },
      lastName: { type: "string", required: false },
      nickname: { type: "string", required: false },
      role: { type: "string", required: false },
      status: { type: "string", required: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Merge domain fields from user_profile into the session payload so
          // server code can read role/firstName/etc directly off the session
          // without an extra query per request.
          const rows = await db
            .select({
              firstName: userProfile.firstName,
              lastName: userProfile.lastName,
              nickname: userProfile.nickname,
              role: userProfile.role,
              status: userProfile.status,
            })
            .from(userProfile)
            .where(eq(userProfile.userId, session.userId))
            .limit(1);
          const profile = rows[0];
          if (!profile) return { data: session };
          return {
            data: {
              ...session,
              firstName: profile.firstName,
              lastName: profile.lastName,
              nickname: profile.nickname ?? undefined,
              role: profile.role,
              status: profile.status,
            },
          };
        },
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "Wardrobe Assistants Admin",
    }),
    // nextCookies must come last so it picks up cookies set by other plugins.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

// Reads the current user's role from the session. Lives in lib/auth.ts so
// lib/permissions.ts can call it without importing from features/users —
// preserves the lib/ ⇏ features/ Biome boundary.
export async function getCurrentUserRole(): Promise<Role | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "SQUAD_MEMBER") return null;
  return role;
}
