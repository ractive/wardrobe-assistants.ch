import { z } from "zod";

// Step 1 — credentials.
//
// Sign-in forms validate **submittability**, not policy. The password
// floor (iter-16f / C-SEC-15, relaxed to 8 in iter-39 §C.1) is a
// *creation* rule and lives in the set-password schema + Better Auth's
// `minPasswordLength`. Enforcing it client-side on sign-in would
// (a) lock out anyone with a legitimate pre-floor legacy password before
// they can reach the "forgot password" flow, and (b) leak the org's
// policy floor to anyone hitting /login. Server decides whether the
// password is correct; the form just makes sure something was typed.
export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

// Step 2 — TOTP code (6 digits).
export const totpSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/u, "Enter the 6-digit code from your authenticator app"),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type TotpInput = z.infer<typeof totpSchema>;
