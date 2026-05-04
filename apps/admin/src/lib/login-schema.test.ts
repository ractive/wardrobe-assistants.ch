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

  it("rejects short password", () => {
    const r = credentialsSchema.safeParse({
      email: "a@b.com",
      password: "short",
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
