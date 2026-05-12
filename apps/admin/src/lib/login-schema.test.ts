import { describe, expect, it } from "vitest";
import { credentialsSchema, totpSchema } from "./login-schema";

describe("login schemas", () => {
  it("accepts valid credentials", () => {
    const r = credentialsSchema.safeParse({
      email: "admin@example.com",
      password: "longenoughpw",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed email", () => {
    const r = credentialsSchema.safeParse({
      email: "not-an-email",
      password: "longenoughpw",
    });
    expect(r.success).toBe(false);
  });

  // Login validates submittability, not policy. A short password must be
  // accepted client-side so users with legacy pre-floor passwords can
  // still hit the server (and either succeed if their password actually
  // works, or be redirected to "forgot password"). The current 8-char
  // floor (iter-39 §C.1, was 12 in iter-16f) is a *creation* rule,
  // exercised in apps/admin/src/app/set-password.
  it("accepts short passwords (creation rules apply server-side only)", () => {
    const r = credentialsSchema.safeParse({
      email: "a@b.com",
      password: "abc",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const r = credentialsSchema.safeParse({
      email: "a@b.com",
      password: "",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a 6-digit TOTP code", () => {
    expect(totpSchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it("rejects non-numeric TOTP code", () => {
    expect(totpSchema.safeParse({ code: "abcdef" }).success).toBe(false);
  });

  it("rejects wrong-length TOTP code", () => {
    expect(totpSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(totpSchema.safeParse({ code: "1234567" }).success).toBe(false);
  });
});
