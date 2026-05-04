import { createDb } from "@wardrobe-assistants/db";
import { schema } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";
import qrcode from "qrcode-terminal";
import { auth } from "../src/lib/auth";
import { isSeedNeeded } from "./seed-admin.lib";

// Bootstraps the very first admin user. Idempotent: if a user with the given
// email already exists, exits 0 without changes. Prints the TOTP secret + an
// ASCII QR exactly once — there is no way to retrieve it later, so capture it
// when this script runs.

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error(
    "Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment. Refusing to seed.",
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

const db = createDb({ url, authToken });

if (!(await isSeedNeeded(db, email))) {
  console.log(`Admin user ${email} already exists; nothing to do.`);
  process.exit(0);
}

// Sign up via the auth API so password hashing matches Better Auth's runtime.
const signUp = await auth.api.signUpEmail({
  body: { email, password, name: email },
});
if (!signUp || !("user" in signUp)) {
  console.error("Failed to create admin user.");
  process.exit(1);
}

// Mark email verified so the admin can sign in straight away.
await db
  .update(schema.user)
  .set({ emailVerified: true, updatedAt: new Date() })
  .where(eq(schema.user.id, signUp.user.id));

// Generate TOTP secret + backup codes by enabling 2FA via the API.
const enable = await auth.api.enableTwoFactor({
  body: { password, issuer: "Wardrobe Assistants Admin" },
  headers: new Headers(),
});

if (!enable || !("totpURI" in enable)) {
  console.error("Failed to enable two-factor authentication.");
  process.exit(1);
}

console.log("\nAdmin user created:", email);
console.log("\nTOTP setup URI:");
console.log(enable.totpURI);
console.log("\nBackup codes (store these somewhere safe):");
for (const code of enable.backupCodes) {
  console.log(`  ${code}`);
}
console.log("\nScan this QR with your authenticator app:");
qrcode.generate(enable.totpURI, { small: true });
console.log("");

process.exit(0);
