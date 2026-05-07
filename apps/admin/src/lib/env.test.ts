// @vitest-environment node
import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const PROD_SECRET = "a".repeat(64);
const REMOTE_DB = "libsql://example.turso.io";
const LOCAL_DB = "file:./dev.db";

const baseDev = {
  NODE_ENV: "development",
  DATABASE_URL: LOCAL_DB,
  BETTER_AUTH_SECRET: "dev-secret-not-used-in-prod",
  BETTER_AUTH_URL: "http://localhost:3000",
  EMAIL_FROM: "Wardrobe Assistants <admin@wardrobe-assistants.ch>",
};

const baseProd = {
  NODE_ENV: "production",
  DATABASE_URL: REMOTE_DB,
  DATABASE_AUTH_TOKEN: "token",
  BETTER_AUTH_SECRET: PROD_SECRET,
  BETTER_AUTH_URL: "https://admin.wardrobe-assistants.ch",
  EMAIL_FROM: "Wardrobe Assistants <admin@wardrobe-assistants.ch>",
  RESEND_API_KEY: "re_123",
};

function firstMessageFor(
  result: ReturnType<typeof envSchema.safeParse>,
  path: string,
) {
  if (result.success) return null;
  return result.error.issues.find((i) => i.path.join(".") === path)?.message;
}

describe("env schema", () => {
  it("accepts a valid dev shape", () => {
    expect(envSchema.safeParse(baseDev).success).toBe(true);
  });

  it("accepts a valid prod shape", () => {
    expect(envSchema.safeParse(baseProd).success).toBe(true);
  });

  it("requires DATABASE_URL", () => {
    const r = envSchema.safeParse({ ...baseDev, DATABASE_URL: "" });
    expect(r.success).toBe(false);
  });

  it("rejects dev with a remote DATABASE_URL", () => {
    const r = envSchema.safeParse({ ...baseDev, DATABASE_URL: REMOTE_DB });
    expect(r.success).toBe(false);
    expect(firstMessageFor(r, "DATABASE_URL")).toMatch(/dev must use/);
  });

  it("rejects prod with a file: DATABASE_URL", () => {
    const r = envSchema.safeParse({ ...baseProd, DATABASE_URL: LOCAL_DB });
    expect(r.success).toBe(false);
    expect(firstMessageFor(r, "DATABASE_URL")).toMatch(/prod must use/);
  });

  it("rejects prod with a short BETTER_AUTH_SECRET", () => {
    const r = envSchema.safeParse({
      ...baseProd,
      BETTER_AUTH_SECRET: "short",
    });
    expect(r.success).toBe(false);
    expect(firstMessageFor(r, "BETTER_AUTH_SECRET")).toMatch(/64 hex chars/);
  });

  it("rejects prod with the .env.example placeholder secret", () => {
    const r = envSchema.safeParse({
      ...baseProd,
      BETTER_AUTH_SECRET: "replace-with-32-byte-hex".padEnd(64, "x"),
    });
    expect(r.success).toBe(false);
    expect(firstMessageFor(r, "BETTER_AUTH_SECRET")).toMatch(/placeholder/);
  });

  it("rejects prod missing RESEND_API_KEY", () => {
    const r = envSchema.safeParse({
      ...baseProd,
      RESEND_API_KEY: undefined,
    });
    expect(r.success).toBe(false);
    expect(firstMessageFor(r, "RESEND_API_KEY")).toMatch(
      /required in production/,
    );
  });

  it("allows test env without the file: tripwire", () => {
    const r = envSchema.safeParse({
      ...baseDev,
      NODE_ENV: "test",
      DATABASE_URL: ":memory:",
    });
    expect(r.success).toBe(true);
  });

  it("treats RESEND_API_KEY as optional in dev", () => {
    const { RESEND_API_KEY: _omit, ...withoutResend } = {
      ...baseDev,
      RESEND_API_KEY: undefined,
    } as Record<string, string | undefined>;
    expect(envSchema.safeParse(withoutResend).success).toBe(true);
  });
});
