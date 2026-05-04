import { z } from "zod";

// Step 1 — credentials.
export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Step 2 — TOTP code (6 digits).
export const totpSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/u, "Enter the 6-digit code from your authenticator app"),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type TotpInput = z.infer<typeof totpSchema>;
