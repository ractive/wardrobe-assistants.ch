import { z } from "zod";

// Centralized env loader for the admin app.
//
// Every server-side env read flows through this module so a missing or
// malformed variable surfaces as a single Zod error at boot, not as a
// confusing null-pointer the first time auth/email/db code runs.
//
// Tripwires enforce the prod/dev boundary:
//   - dev must use a local libSQL file (file:…)
//   - prod must use a remote libSQL DB (libsql://… or https://…)
//   - prod must have a 64-char hex BETTER_AUTH_SECRET (32 bytes), not the
//     placeholder string from .env.example.
//
// The `test` branch reuses dev defaults but skips the file: tripwire because
// some unit tests run against in-memory libSQL (`:memory:` shapes).

const DEV_SECRET_PLACEHOLDER = /^replace-with/i;
const HEX_64 = /^[0-9a-f]{64}$/i;

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
    EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required"),
    RESEND_API_KEY: z.string().optional(),
    // Only consulted by `seed:admin` / `db:reset`. Not needed for the
    // running app — left optional so dev/prod boots don't trip on absence.
    ADMIN_EMAIL: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    // VAPID keys for Web Push (iter-23). All three are optional at boot:
    // push paths short-circuit (no-op + warn) when any are missing —
    // mirroring the RESEND_API_KEY dev-fallback pattern.
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const { NODE_ENV, DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY } =
      value;

    if (NODE_ENV === "development" && !DATABASE_URL.startsWith("file:")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message:
          "dev must use a local libSQL file (DATABASE_URL=file:./dev.db); refusing to boot against a remote DB.",
      });
    }

    if (NODE_ENV === "production" && DATABASE_URL.startsWith("file:")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message:
          "prod must use a remote libSQL DB; refusing to boot against a local file.",
      });
    }

    if (NODE_ENV === "production") {
      if (!HEX_64.test(BETTER_AUTH_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["BETTER_AUTH_SECRET"],
          message:
            "BETTER_AUTH_SECRET must be 64 hex chars (32 bytes) in production. Generate with: openssl rand -hex 32",
        });
      }
      if (DEV_SECRET_PLACEHOLDER.test(BETTER_AUTH_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["BETTER_AUTH_SECRET"],
          message:
            "BETTER_AUTH_SECRET still matches the .env.example placeholder; generate a real one with `openssl rand -hex 32`.",
        });
      }
      // Resend is optional today, but once transactional senders land it must
      // be set in prod. Tripwire here so missing keys fail at boot rather than
      // at first email send.
      if (!RESEND_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["RESEND_API_KEY"],
          message: "RESEND_API_KEY is required in production.",
        });
      }
    }
  });

export type EnvShape = z.infer<typeof envSchema>;

export type Env = Readonly<{
  nodeEnv: EnvShape["NODE_ENV"];
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  betterAuthSecret: string;
  betterAuthUrl: string;
  emailFrom: string;
  resendApiKey: string | undefined;
  adminEmail: string | undefined;
  adminPassword: string | undefined;
  vapidPublicKey: string | undefined;
  vapidPrivateKey: string | undefined;
  vapidSubject: string | undefined;
}>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => {
      const path = issue.path.join(".") || "(root)";
      return `  - ${path}: ${issue.message}`;
    });
    throw new Error(
      `Invalid environment configuration:\n${lines.join("\n")}\n` +
        `See apps/admin/.env.example for the expected shape.`,
    );
  }

  return Object.freeze({
    nodeEnv: parsed.data.NODE_ENV,
    databaseUrl: parsed.data.DATABASE_URL,
    databaseAuthToken: parsed.data.DATABASE_AUTH_TOKEN || undefined,
    betterAuthSecret: parsed.data.BETTER_AUTH_SECRET,
    betterAuthUrl: parsed.data.BETTER_AUTH_URL,
    emailFrom: parsed.data.EMAIL_FROM,
    resendApiKey: parsed.data.RESEND_API_KEY || undefined,
    adminEmail: parsed.data.ADMIN_EMAIL || undefined,
    adminPassword: parsed.data.ADMIN_PASSWORD || undefined,
    vapidPublicKey: parsed.data.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
    vapidPrivateKey: parsed.data.VAPID_PRIVATE_KEY || undefined,
    vapidSubject: parsed.data.VAPID_SUBJECT || undefined,
  });
}

// Lazy: parsing fires on first property access, not at module load. Importing
// `envSchema` from a unit test (e.g. `env.test.ts`) won't trigger validation
// against the test process's env, which is intentionally bare.
let cached: Env | undefined;
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    if (!cached) cached = parseEnv(process.env);
    return cached[prop as keyof Env];
  },
});
