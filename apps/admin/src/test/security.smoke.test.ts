// @vitest-environment node
//
// iter-16f cross-feature smoke tests. Lives in src/test/ (not under any
// feature/) so it can import from both `features/users` and
// `features/bookings` — Biome's `noRestrictedImports` overrides forbid
// cross-feature imports inside features/, but tests at the harness
// boundary are the right place to verify whole-system invariants.
//
// Coverage:
//   - missing user_profile → every gated action denies (C-SEC-13)
//   - rate limiter rejects with 429 + Retry-After (C-SEC-02)
//
// What we mock vs don't:
//   - `next/headers`: shared via harness.activeCookies() so action calls
//     pick up the right session cookie via runAs().
//   - `next/cache`, `server-only`, `@/lib/email` mocked for the same
//     reasons as the per-feature smoke files.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type Harness, setupHarness } from "@/test/http-harness";

let harness: Harness;

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(harness.activeCookies()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {}),
  sendTemplated: vi.fn(async () => {}),
  sendTemplatedBatch: vi.fn(async () => ({ sent: 0, failed: 0 })),
}));

// iter-23: actions now call notifyUser which calls sendPush. Mock so tests
// don't need VAPID env vars.
vi.mock("@/lib/push", () => ({
  sendPush: vi.fn(async () => ({ sent: 0 })),
}));

describe("iter-16f security — cross-feature smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  // iter-16f / C-SEC-13: pin the 2026-05-09 incident. A Better Auth user
  // without a corresponding `user_profile` row must have *no* role and
  // therefore fail every gated action — accept either `PermissionError`
  // (session present, no role) or `UnauthenticatedError` (Better Auth
  // refuses to mint a session for the profile-less user). Both are
  // hard-deny outcomes; the regression we care about is that *some*
  // gated action is reachable.
  it("missing user_profile → every gated action denies", async () => {
    // Use the squad-member seed path to get a known-good signed-in
    // cookie, then drop the profile row so the user is in the
    // post-incident state (auth user exists, profile missing).
    const seeded = await harness.seedSquadMember({
      email: "noprofile@security-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const cookies = seeded.cookies;
    const { userProfile } = await import("@wardrobe-assistants/db/schema");
    const { eq } = await import("drizzle-orm");
    await harness.db
      .delete(userProfile)
      .where(eq(userProfile.userId, seeded.userId));

    const { listUsers } = await import("@/features/users/server/queries");
    const { inviteUser, deleteUser } = await import(
      "@/features/users/server/actions"
    );
    const { createBooking } = await import(
      "@/features/bookings/server/actions"
    );
    const { listBookings } = await import("@/features/bookings/server/queries");

    await expect(
      harness.runAs(cookies, () => listUsers()),
    ).rejects.toMatchObject({
      name: expect.stringMatching(/^(PermissionError|UnauthenticatedError)$/),
    });

    await expect(
      harness.runAs(cookies, () => listBookings()),
    ).rejects.toMatchObject({
      name: expect.stringMatching(/^(PermissionError|UnauthenticatedError)$/),
    });

    await expect(
      harness.runAs(cookies, () =>
        inviteUser({
          email: "x@x.test",
          firstName: "x",
          lastName: "y",
          nickname: undefined,
          mobileNumber: undefined,
          role: "SQUAD_MEMBER",
        }),
      ),
    ).rejects.toMatchObject({
      name: expect.stringMatching(/^(PermissionError|UnauthenticatedError)$/),
    });

    await expect(
      harness.runAs(cookies, () => deleteUser({ userId: "anyone" })),
    ).rejects.toMatchObject({
      name: expect.stringMatching(/^(PermissionError|UnauthenticatedError)$/),
    });

    await expect(
      harness.runAs(cookies, () =>
        createBooking({
          name: "n",
          date: new Date(),
          venue: "v",
          notes: undefined,
          customerName: undefined,
          customerEmail: undefined,
          customerPhone: undefined,
          // iter-37 §C.3: required fields for new bookings (app-layer).
          startTime: "18:00",
          durationHours: 8,
          venueName: undefined,
          venueCity: "Zurich",
          comment: undefined,
        }),
      ),
    ).rejects.toMatchObject({
      name: expect.stringMatching(/^(PermissionError|UnauthenticatedError)$/),
    });
  });

  // iter-16f / C-SEC-02: in-memory rate limiter rejects after the bucket
  // is exhausted, returning a soft error result on the invite path
  // (the action result-shape contract — no thrown 429 here, since
  // server actions don't carry HTTP status).
  it("inviteUser rejects past the 10/hour bucket", async () => {
    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();

    const admin = await harness.seedAdmin({
      email: "admin-rl@security-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const { inviteUser } = await import("@/features/users/server/actions");

    // Fill the bucket — 10 successful invites.
    for (let i = 0; i < 10; i++) {
      const r = await harness.runAs(admin.cookies, () =>
        inviteUser({
          email: `invitee-rl-${i}@security-smoke.local`,
          firstName: `R${i}`,
          lastName: "L",
          nickname: undefined,
          mobileNumber: undefined,
          role: "SQUAD_MEMBER",
        }),
      );
      expect(r.error, `invite ${i} should have succeeded: ${r.message}`).toBe(
        false,
      );
    }

    // 11th must be soft-rejected by the limiter.
    const r11 = await harness.runAs(admin.cookies, () =>
      inviteUser({
        email: "invitee-rl-11@security-smoke.local",
        firstName: "R",
        lastName: "L",
        nickname: undefined,
        mobileNumber: undefined,
        role: "SQUAD_MEMBER",
      }),
    );
    expect(r11.error).toBe(true);
    expect(r11.message).toMatch(/limit/i);
  });

  // The auth-route layer enforces the same primitive on raw HTTP. We
  // don't have a Next.js runtime in vitest, but the route exports
  // `POST` directly — calling it as a function is equivalent.
  it("auth POST returns 429 + Retry-After once login bucket is exhausted", async () => {
    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();

    const route = await import("@/app/api/auth/[...all]/route");

    function buildRequest(): Request {
      return new Request("https://admin.test.local/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.7",
        },
        body: JSON.stringify({
          email: "rl-target@security-smoke.local",
          password: "wrong-password-1234",
        }),
      });
    }

    // 5 attempts within window — Better Auth will reject with 4xx for
    // bad creds, but we don't care about the upstream status. The 6th
    // must come from our limiter (status 429 + Retry-After).
    for (let i = 0; i < 5; i++) {
      await route.POST(buildRequest());
    }
    const blocked = await route.POST(buildRequest());
    expect(blocked.status).toBe(429);
    const retryAfter = blocked.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
