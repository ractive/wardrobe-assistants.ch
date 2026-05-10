import { describe, expect, it } from "vitest";
import {
  deleteUserInput,
  inviteUserInput,
  messageUserInput,
  userListItem,
} from "./schema";

describe("inviteUserInput", () => {
  const valid = {
    email: "new@example.com",
    firstName: "Mira",
    lastName: "Adler",
    role: "SQUAD_MEMBER" as const,
  };

  it("accepts a minimal valid invite", () => {
    expect(inviteUserInput.safeParse(valid).success).toBe(true);
  });

  it("rejects malformed emails", () => {
    expect(
      inviteUserInput.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("requires firstName and lastName", () => {
    expect(inviteUserInput.safeParse({ ...valid, firstName: "" }).success).toBe(
      false,
    );
    expect(
      inviteUserInput.safeParse({ ...valid, lastName: "   " }).success,
    ).toBe(false);
  });

  it("constrains role to ADMIN | SQUAD_MEMBER", () => {
    expect(inviteUserInput.safeParse({ ...valid, role: "OWNER" }).success).toBe(
      false,
    );
    expect(inviteUserInput.safeParse({ ...valid, role: "ADMIN" }).success).toBe(
      true,
    );
  });

  it("normalises empty optional strings to undefined", () => {
    const r = inviteUserInput.safeParse({
      ...valid,
      nickname: "",
      mobileNumber: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nickname).toBeUndefined();
      expect(r.data.mobileNumber).toBeUndefined();
    }
  });

  it("accepts international format with separators and normalises to E.164", () => {
    const r = inviteUserInput.safeParse({
      ...valid,
      mobileNumber: "+41 79 123 45 67",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mobileNumber).toBe("+41791234567");
    }
  });

  it("accepts Swiss local format and normalises to E.164", () => {
    const r = inviteUserInput.safeParse({
      ...valid,
      mobileNumber: "0791234567",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mobileNumber).toBe("+41791234567");
    }
  });

  it("rejects too-short number", () => {
    expect(
      inviteUserInput.safeParse({ ...valid, mobileNumber: "12345" }).success,
    ).toBe(false);
  });

  it("rejects non-numeric junk", () => {
    expect(
      inviteUserInput.safeParse({
        ...valid,
        mobileNumber: "+1 555 not-a-number",
      }).success,
    ).toBe(false);
  });
});

describe("messageUserInput", () => {
  it("requires non-empty subject and body", () => {
    expect(
      messageUserInput.safeParse({
        userId: "u1",
        subject: "",
        body: "hi",
      }).success,
    ).toBe(false);
    expect(
      messageUserInput.safeParse({
        userId: "u1",
        subject: "Hi",
        body: "   ",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid message", () => {
    expect(
      messageUserInput.safeParse({
        userId: "u1",
        subject: "Welcome",
        body: "Glad to have you onboard.",
      }).success,
    ).toBe(true);
  });
});

describe("deleteUserInput", () => {
  it("requires a non-empty userId", () => {
    expect(deleteUserInput.safeParse({ userId: "" }).success).toBe(false);
    expect(deleteUserInput.safeParse({ userId: "u1" }).success).toBe(true);
  });
});

describe("userListItem", () => {
  it("rejects an unknown status", () => {
    expect(
      userListItem.safeParse({
        id: "u1",
        email: "a@b.com",
        displayName: "A B",
        role: "ADMIN",
        status: "lurking",
        createdAt: new Date(),
      }).success,
    ).toBe(false);
  });
});
