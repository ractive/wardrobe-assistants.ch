import { z } from "zod";

// Step 1 — credentials.
export const credentialsSchema = z.object({
  email: z.string().email(),
  // iter-16f / C-SEC-15: floor raised from 8 → 12. Length is the single
  // most effective rule; we deliberately don't add character-class
  // requirements (NIST SP 800-63B-style guidance: length over complexity).
  password: z.string().min(12, "Password must be at least 12 characters"),
});

// Step 2 — TOTP code (6 digits).
export const totpSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/u, "Enter the 6-digit code from your authenticator app"),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type TotpInput = z.infer<typeof totpSchema>;
