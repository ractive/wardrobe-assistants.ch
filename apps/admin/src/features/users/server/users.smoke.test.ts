// @vitest-environment node
//
// Smoke test for the users feature — the canonical reference future feature
// slices copy. Exercises the real auth + permission + Drizzle schema path,
// not mocks. If iter-14's `user_profile` migration ever falls out of the
// journal, this fails the PR build instead of the prod smoke (the iter-15b
// surprise that motivated iter-15c).
//
// What we mock vs don't:
//   - `next/headers`        : mocked. No Next.js runtime in vitest, so
//                             `headers()` would otherwise throw. The mock
//                             returns the harness's active cookies, which
//                             `runAs(cookies, fn)` swaps per call.
//   - `next/cache`          : mocked. `revalidatePath()` requires a Next
//                             render context.
//   - `@/lib/email`         : mocked so invites don't try to hit Resend.
//   - DB, auth, permissions : real, against the harness's tmp libSQL.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertSecurityHeadersConfigured,
  type Harness,
  setupHarness,
} from "@/test/http-harness";

let harness: Harness;

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(harness.activeCookies()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// `server-only` is a Next.js sentinel that throws if imported in a
// client/edge runtime. In a vitest Node environment it just isn't installed
// — stubbing to an empty module lets us import server-side modules that
// gate themselves with it.
vi.mock("server-only", () => ({}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {}),
  sendTemplated: vi.fn(async () => {}),
  sendTemplatedBatch: vi.fn(async () => ({ sent: 0, failed: 0 })),
}));

// iter-23: messageUser now calls notifyUser (email + push). Mock push so
// tests don't need VAPID env vars.
vi.mock("@/lib/push", () => ({
  sendPush: vi.fn(async () => ({ sent: 0 })),
}));

describe("users feature — smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  it("admin can invite a user and the new user shows up in listUsers()", async () => {
    const admin = await harness.seedAdmin({
      email: "admin1@smoke.local",
      password: "Sup3rSecure!Pass",
      firstName: "Iter",
      lastName: "Admin",
    });

    const { inviteUser } = await import("./actions");
    const { listUsers } = await import("./queries");

    const result = await harness.runAs(admin.cookies, () =>
      inviteUser({
        email: "invitee1@smoke.local",
        firstName: "Inv",
        lastName: "Itee",
        nickname: undefined,
        mobileNumber: undefined,
        role: "SQUAD_MEMBER",
      }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    const list = await harness.runAs(admin.cookies, () => listUsers());
    const emails = list.map((u) => u.email);
    expect(emails).toContain("admin1@smoke.local");
    expect(emails).toContain("invitee1@smoke.local");
    const invitee = list.find((u) => u.email === "invitee1@smoke.local");
    expect(invitee?.role).toBe("SQUAD_MEMBER");
    expect(invitee?.status).toBe("invited");
  });

  it("squad member is denied USER_DELETE — withPermission throws PermissionError", async () => {
    const sm = await harness.seedSquadMember({
      email: "sm1@smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const target = await harness.seedSquadMember({
      email: "target@smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { deleteUser } = await import("./actions");

    await expect(
      harness.runAs(sm.cookies, () => deleteUser({ userId: target.userId })),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  it("admin can delete a non-self user", async () => {
    const admin = await harness.seedAdmin({
      email: "admin2@smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const target = await harness.seedSquadMember({
      email: "target2@smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { deleteUser } = await import("./actions");
    const { listUsers } = await import("./queries");

    const result = await harness.runAs(admin.cookies, () =>
      deleteUser({ userId: target.userId }),
    );
    expect(result.error).toBe(false);
    const list = await harness.runAs(admin.cookies, () => listUsers());
    expect(list.map((u) => u.email)).not.toContain("target2@smoke.local");
  });

  // iter-16b edge hardening: every authenticated admin route must carry the
  // CDN-safe Cache-Control + the security-header set so the bunny pull-zone
  // never caches a session-bearing body and clickjacking/XSS surfaces stay
  // closed. The assertion reads next.config directly, since the smoke
  // harness has no Next runtime; that's also what makes this a generic
  // helper iter-17/18 inherit for free.
  it.each([
    ["Cache-Control"],
    ["X-Frame-Options"],
    ["X-Content-Type-Options"],
    ["Referrer-Policy"],
    ["Permissions-Policy"],
    ["Strict-Transport-Security"],
    ["Content-Security-Policy"],
  ])("admin response carries %s", async (header) => {
    await assertSecurityHeadersConfigured([header]);
  });

  it("messageUser strips CR/LF from subject (header-injection guard)", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-crlf@smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const target = await harness.seedSquadMember({
      email: "target-crlf@smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const sendMock = email.sendTemplated as unknown as ReturnType<typeof vi.fn>;
    sendMock.mockClear();

    const { messageUser } = await import("./actions");
    const result = await harness.runAs(admin.cookies, () =>
      messageUser({
        userId: target.userId,
        subject: "Hello\r\nBcc: attacker@example.com",
        body: "Body content",
      }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);
    // Subject is stripped of CR/LF by the Zod schema transform before
    // reaching sendTemplated — verify the params carry a clean subject.
    expect(sendMock).toHaveBeenCalledTimes(1);
    // sendTemplated("userDirectMessage", to, { subject, body })
    const params = sendMock.mock.calls[0]?.[2] as { subject: string };
    expect(params?.subject).toBeDefined();
    expect(params?.subject).not.toMatch(/[\r\n]/);
  });

  // iter-16f / C-SEC-09: query-level authz. listUsers / getUserById are
  // now security boundaries on their own — calling them without the
  // right perm throws.
  it("listUsers throws without sign-in (UnauthenticatedError)", async () => {
    const { listUsers } = await import("./queries");
    await expect(listUsers()).rejects.toMatchObject({
      name: "UnauthenticatedError",
    });
  });

  it("listUsers throws for squad member (PermissionError)", async () => {
    const sm = await harness.seedSquadMember({
      email: "sm-q@smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const { listUsers } = await import("./queries");
    await expect(
      harness.runAs(sm.cookies, () => listUsers()),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  // iter-16f / C-SEC-10: every gated mutation lands one audit_log row.
  it("inviteUser writes an audit_log row", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-audit@smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const { inviteUser } = await import("./actions");
    const result = await harness.runAs(admin.cookies, () =>
      inviteUser({
        email: "invitee-audit@smoke.local",
        firstName: "A",
        lastName: "B",
        nickname: undefined,
        mobileNumber: undefined,
        role: "SQUAD_MEMBER",
      }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    const { auditLog } = await import("@wardrobe-assistants/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await harness.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.invite"));
    const ours = rows.find((r) => {
      if (!r.metadata) return false;
      const m = JSON.parse(r.metadata) as { email?: string };
      return m.email === "invitee-audit@smoke.local";
    });
    expect(ours).toBeDefined();
    expect(ours?.actorUserId).toBe(admin.userId);
    expect(ours?.targetType).toBe("user");
    expect(ours?.targetId).toBeTruthy();
  });

  it("admin cannot delete their own account", async () => {
    const admin = await harness.seedAdmin({
      email: "admin3@smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const { deleteUser } = await import("./actions");
    const result = await harness.runAs(admin.cookies, () =>
      deleteUser({ userId: admin.userId }),
    );
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/your own account/i);
  });
});
