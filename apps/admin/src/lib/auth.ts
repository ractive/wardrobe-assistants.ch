import { schema, userProfile } from "@wardrobe-assistants/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { sendTemplated } from "./email";
import { env } from "./env";
import type { Role } from "./permissions";

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  // iter-16f / audit C-SEC-14: explicit allow-list for cross-origin
  // sign-in callbacks. Better Auth derives a default from `baseURL`, but
  // pinning the value here makes the trust boundary visible in code and
  // prevents a surprise widening if a plugin later mutates options.
  trustedOrigins: [env.betterAuthUrl],
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
    // iter-16f / C-SEC-15: keep the auth-layer floor in sync with the
    // 12-char zod schema used by the login + set-password forms. Without
    // this, the form schema is the only check on password length.
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) => {
      await sendTemplated("passwordReset", user.email, { resetUrl: url });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendTemplated("verifyEmail", user.email, { verifyUrl: url });
    },
  },
  // The iter-15 attempt to merge user_profile fields into session.user via
  // `databaseHooks.session.create.before` was a no-op: the session table has
  // no role/firstName/etc columns, so Better Auth silently dropped the
  // returned data. Permission gates that read `session.user.role` always saw
  // undefined → every gate would 401 in prod the moment someone clicked one.
  // The bug stayed invisible because no permission-gated route had been hit
  // through to a user with role enrichment yet.
  //
  // The new model: source of truth for role/status is `user_profile`. Reads
  // happen at permission-check time in `getCurrentUserRole` and inside
  // `withPermission`. The extra query per gated action is acceptable —
  // the admin surface is low-traffic and `user_profile` is keyed on user.id.
  // First-sign-in `invited → verified` flip moves to the same code path.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Best-effort: flip status from invited → verified on the user's
          // first successful sign-in. The `status = invited` predicate makes
          // this idempotent and prevents `verifiedAt` being overwritten on
          // every subsequent sign-in. Failures must not block sign-in.
          try {
            await db
              .update(userProfile)
              .set({ status: "verified", verifiedAt: new Date() })
              .where(
                and(
                  eq(userProfile.userId, session.userId),
                  eq(userProfile.status, "invited"),
                ),
              );
          } catch (err) {
            console.error(
              "session.create: failed to flip status invited→verified",
              err,
            );
          }
          return { data: session };
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

// Per-request cached wrapper around getSession. React's `cache()` dedupes
// identical calls within a single server request — multiple components in the
// same RSC render tree (layout + page + permission gates) all resolve from
// one underlying Better Auth call instead of N.
export const getCachedSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// Reads the current user's role by joining the active session to
// user_profile. Lives in lib/auth.ts so lib/permissions.ts can call it
// without importing from features/users — preserves the lib/ ⇏ features/
// Biome boundary.
export async function getCurrentUserRole(): Promise<Role | null> {
  const session = await getCachedSession();
  if (!session) return null;
  return roleForUserId(session.user.id);
}

// Internal helper — also used by withPermission. Looks up the role by
// user.id from the user_profile source of truth.
export async function roleForUserId(userId: string): Promise<Role | null> {
  const rows = await db
    .select({ role: userProfile.role })
    .from(userProfile)
    .where(eq(userProfile.userId, userId))
    .limit(1);
  const role = rows[0]?.role;
  if (role !== "ADMIN" && role !== "SQUAD_MEMBER") return null;
  return role;
}
