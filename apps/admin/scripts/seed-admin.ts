import { createDb } from "@wardrobe-assistants/db";
import { schema } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";
import qrcode from "qrcode-terminal";
import { auth } from "../src/lib/auth";
import { env } from "../src/lib/env";
import { isSeedNeeded } from "./seed-admin.lib";

// Bootstraps the very first admin user. Idempotent: if a user with the given
// email already exists, exits 0 without changes. Prints the TOTP secret + an
// ASCII QR exactly once — there is no way to retrieve it later, so capture it
// when this script runs.

const email = env.adminEmail;
const password = env.adminPassword;

if (!email || !password) {
  console.error(
    "Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment. Refusing to seed.",
  );
  process.exit(1);
}

const db = createDb({ url: env.databaseUrl, authToken: env.databaseAuthToken });

if (!(await isSeedNeeded(db, email))) {
  console.log(`Admin user ${email} already exists; nothing to do.`);
  process.exit(0);
}

// Sign up via the auth API so password hashing matches Better Auth's runtime.
// Empty Headers satisfies Better Auth's server-API origin-check middleware
// when called outside an HTTP request context (e.g. from this CLI).
const signUp = await auth.api.signUpEmail({
  body: { email, password, name: email },
  headers: new Headers(),
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

// Sign in to obtain a session so the next call (enableTwoFactor) is
// authenticated. Better Auth's API requires an active session for
// account-mutating actions; enableTwoFactor cannot be called as the unauthed
// CLI would.
const signInRes = await auth.api.signInEmail({
  body: { email, password },
  asResponse: true,
});
const setCookie = signInRes.headers.get("set-cookie");
const sessionHeaders = new Headers();
if (setCookie) sessionHeaders.set("cookie", setCookie);

// Generate TOTP secret + backup codes by enabling 2FA via the API.
const enable = await auth.api.enableTwoFactor({
  body: { password, issuer: "Wardrobe Assistants Admin" },
  headers: sessionHeaders,
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
