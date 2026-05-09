import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@/lib/permissions";

vi.mock("@/lib/permissions", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/permissions")>();
  return {
    ...real,
    // For action tests the wrapper just injects a fixed actorId; the real
    // perm-check path is exercised by lib/permissions.test.ts.
    withPermission: <TArgs extends unknown[], TResult>(
      _perm: Permission,
      action: (userId: string, ...args: TArgs) => Promise<TResult>,
    ) => {
      return (...args: TArgs) => action("actor-1", ...args);
    },
  };
});

vi.mock("@/lib/db", () => ({ db: makeDbMock() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      requestPasswordReset: vi.fn(),
    },
  },
}));
vi.mock("@/lib/email");

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { deleteUser, inviteUser, messageUser } from "./actions";

function makeDbMock() {
  // Reset on every test via beforeEach. Each chain returns a configurable
  // stub that records calls and returns whatever the test sets.
  return {
    _selectResults: [] as unknown[][],
    _insertImpl: vi.fn(async () => undefined),
    _deleteWhereCalled: vi.fn(),
    _deleteReturning: [] as unknown[],
    select() {
      const next = (this._selectResults.shift() ?? []) as unknown[];
      return {
        from: () => ({
          where: () => ({ limit: async () => next }),
          innerJoin: () => ({
            where: () => ({ limit: async () => next }),
            orderBy: async () => next,
          }),
        }),
      };
    },
    insert() {
      return { values: this._insertImpl };
    },
    delete() {
      const self = this;
      return {
        where(arg: unknown) {
          self._deleteWhereCalled(arg);
          return {
            returning: async () => self._deleteReturning,
          };
        },
      };
    },
  };
}

const dbMock = db as unknown as ReturnType<typeof makeDbMock>;
const signUpMock = auth.api.signUpEmail as unknown as ReturnType<typeof vi.fn>;
const resetMock = auth.api.requestPasswordReset as unknown as ReturnType<
  typeof vi.fn
>;
const sendEmailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  dbMock._selectResults = [];
  dbMock._insertImpl = vi.fn(async () => undefined);
  dbMock._deleteWhereCalled = vi.fn();
  dbMock._deleteReturning = [];
  signUpMock.mockReset();
  resetMock.mockReset();
  resetMock.mockResolvedValue(undefined);
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseInvite = {
  email: "new@example.com",
  firstName: "Mira",
  lastName: "Adler",
  nickname: undefined,
  mobileNumber: undefined,
  role: "SQUAD_MEMBER" as const,
};

describe("inviteUser", () => {
  it("rejects invalid input", async () => {
    const r = await inviteUser({ ...baseInvite, email: "bad" });
    expect(r.error).toBe(true);
  });

  it("refuses duplicates", async () => {
    dbMock._selectResults = [[{ id: "u1" }]];
    const r = await inviteUser(baseInvite);
    expect(r.error).toBe(true);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("creates user, profile, and triggers the reset flow", async () => {
    dbMock._selectResults = [[]];
    signUpMock.mockResolvedValue({ user: { id: "u-new" } });
    const r = await inviteUser(baseInvite);
    expect(r).toEqual({ error: false, message: "Invitation sent." });
    expect(signUpMock).toHaveBeenCalledOnce();
    // 2 inserts: user_profile (the invite) + audit_log (iter-16f).
    expect(dbMock._insertImpl).toHaveBeenCalledTimes(2);
    expect(resetMock).toHaveBeenCalledWith({
      body: { email: baseInvite.email, redirectTo: "/set-password" },
      headers: expect.any(Headers),
    });
  });

  it("uses nickname for the auth display name when provided", async () => {
    dbMock._selectResults = [[]];
    signUpMock.mockResolvedValue({ user: { id: "u-new" } });
    await inviteUser({ ...baseInvite, nickname: "Mira A." });
    const call = signUpMock.mock.calls[0]?.[0] as {
      body: { name: string };
    };
    expect(call.body.name).toBe("Mira A.");
  });

  it("returns an error when signUp fails", async () => {
    dbMock._selectResults = [[]];
    signUpMock.mockResolvedValue(null);
    const r = await inviteUser(baseInvite);
    expect(r.error).toBe(true);
    expect(dbMock._insertImpl).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("surfaces a generic error + correlation ID if requestPasswordReset throws", async () => {
    dbMock._selectResults = [[]];
    signUpMock.mockResolvedValue({ user: { id: "u-new" } });
    resetMock.mockRejectedValue(new Error("smtp down"));
    const r = await inviteUser(baseInvite);
    expect(r.error).toBe(true);
    if (r.error) {
      // iter-16f / C-SEC-08: do not propagate the underlying error
      // text. The user-facing message is generic; the correlation ID
      // (`ref ...`) cross-references the audit-log row + server logs.
      expect(r.message).not.toContain("smtp down");
      expect(r.message).toMatch(/invite email could not be sent/i);
      expect(r.message).toMatch(/ref [0-9A-Z]{20,}/);
    }
  });
});

describe("deleteUser", () => {
  it("refuses self-deletion", async () => {
    const r = await deleteUser({ userId: "actor-1" });
    expect(r).toEqual({
      error: true,
      message: "You cannot delete your own account.",
    });
    expect(dbMock._deleteWhereCalled).not.toHaveBeenCalled();
  });

  it("deletes a different user", async () => {
    dbMock._deleteReturning = [{ id: "u2" }];
    const r = await deleteUser({ userId: "u2" });
    expect(r).toEqual({ error: false, message: "User deleted." });
    expect(dbMock._deleteWhereCalled).toHaveBeenCalledOnce();
  });

  it("returns 'User not found' when no rows are affected", async () => {
    dbMock._deleteReturning = [];
    const r = await deleteUser({ userId: "missing" });
    expect(r).toEqual({ error: true, message: "User not found." });
  });

  it("rejects empty userId", async () => {
    const r = await deleteUser({ userId: "" });
    expect(r.error).toBe(true);
  });
});

describe("messageUser", () => {
  it("rejects invalid input", async () => {
    const r = await messageUser({ userId: "u1", subject: "", body: "hi" });
    expect(r.error).toBe(true);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 'User not found' when no user matches", async () => {
    dbMock._selectResults = [[]];
    const r = await messageUser({
      userId: "missing",
      subject: "Hi",
      body: "Body",
    });
    expect(r).toEqual({ error: true, message: "User not found." });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends an email to the target user", async () => {
    dbMock._selectResults = [[{ email: "target@example.com" }]];
    const r = await messageUser({
      userId: "u2",
      subject: "Welcome",
      body: "Hello there.",
    });
    expect(r).toEqual({ error: false, message: "Message sent." });
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "target@example.com",
      subject: "Welcome",
      text: "Hello there.",
    });
  });

  it("returns a sanitized error + correlation ID when sendEmail throws", async () => {
    dbMock._selectResults = [[{ email: "target@example.com" }]];
    sendEmailMock.mockRejectedValue(new Error("smtp boom"));
    const r = await messageUser({
      userId: "u2",
      subject: "Welcome",
      body: "Hello there.",
    });
    expect(r.error).toBe(true);
    if (r.error) {
      // iter-16f / C-SEC-08: generic message + correlation ID, not the
      // raw Resend / nodemailer error text.
      expect(r.message).not.toContain("smtp boom");
      expect(r.message).toMatch(/Failed to send message/);
      expect(r.message).toMatch(/ref [0-9A-Z]{20,}/);
    }
  });
});
