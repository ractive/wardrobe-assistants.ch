// One-off temporary admin seeder — iter-15b verification only. Creates an
// admin user WITHOUT enabling 2FA so the e2e sign-in via ff-rdp can complete
// with just email + password. Delete this file and the seeded user after the
// run is verified.
//
// Reads ADMIN_EMAIL + ADMIN_PASSWORD from env; everything else (DATABASE_URL,
// DATABASE_AUTH_TOKEN, BETTER_AUTH_SECRET, BETTER_AUTH_URL, EMAIL_FROM,
// RESEND_API_KEY) must also be set so the env validator doesn't trip.
//
// iter-16b production guardrails (audit C-SEC-05):
//   - Refuse if NODE_ENV === "production".
//   - Require ALLOW_TEMP_ADMIN === "1" as an explicit confirmation flag.
//   - Require the seeded email to match @wardrobe-assistants.ch so prod
//     cleanup queries can scope safely.
// Each refusal exits 1 with a clear message — no silent no-op. The
// motivating incident: an iter-15b temp admin reached prod and lingered
// until manual cleanup on 2026-05-09.
import { createDb } from "@wardrobe-assistants/db";
import { schema } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";
import { env } from "../src/lib/env";
import { isSeedNeeded } from "./seed-admin.lib";

if (process.env.NODE_ENV === "production") {
  console.error(
    "Refusing to seed: NODE_ENV=production. seed-temp-admin is dev-only; " +
      "use the production admin invite flow instead.",
  );
  process.exit(1);
}
if (process.env.ALLOW_TEMP_ADMIN !== "1") {
  console.error(
    "Refusing to seed: ALLOW_TEMP_ADMIN!=1. Set ALLOW_TEMP_ADMIN=1 to " +
      "explicitly opt in (the wrapper script does this for interactive runs).",
  );
  process.exit(1);
}

const email = env.adminEmail;
const password = env.adminPassword;
if (!email || !password) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in env.");
  process.exit(1);
}
if (!email.toLowerCase().endsWith("@wardrobe-assistants.ch")) {
  console.error(
    `Refusing to seed: ADMIN_EMAIL must end in @wardrobe-assistants.ch ` +
      `(got: ${email}). This keeps prod cleanup queries scoped safely.`,
  );
  process.exit(1);
}

const db = createDb({ url: env.databaseUrl, authToken: env.databaseAuthToken });

if (!(await isSeedNeeded(db, email))) {
  console.log(`User ${email} already exists; nothing to do.`);
  process.exit(0);
}

const signUp = await auth.api.signUpEmail({
  body: { email, password, name: email },
  headers: new Headers(),
});
if (!signUp || !("user" in signUp)) {
  console.error("Failed to create user.");
  process.exit(1);
}

await db
  .update(schema.user)
  .set({ emailVerified: true, updatedAt: new Date() })
  .where(eq(schema.user.id, signUp.user.id));

const existingProfile = await db
  .select()
  .from(schema.userProfile)
  .where(eq(schema.userProfile.userId, signUp.user.id))
  .limit(1);
if (existingProfile.length === 0) {
  const now = new Date();
  await db.insert(schema.userProfile).values({
    userId: signUp.user.id,
    firstName: "Temp",
    lastName: "Admin",
    nickname: null,
    mobileNumber: null,
    role: "ADMIN",
    status: "verified",
    invitedAt: now,
    verifiedAt: now,
  });
}

console.log(`Seeded admin (no 2FA): ${email}`);
process.exit(0);
