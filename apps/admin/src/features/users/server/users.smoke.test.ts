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
import { type Harness, setupHarness } from "@/test/http-harness";

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

    const list = await listUsers();
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
    const list = await listUsers();
    expect(list.map((u) => u.email)).not.toContain("target2@smoke.local");
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
