// @vitest-environment node
//
// Self-test for the smoke harness. If this file ever 500s, every
// `*.smoke.test.ts` in the codebase breaks the same way at the same line —
// debug here first, not in the consumers.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Harness, setupHarness } from "./http-harness";

describe("http-harness", () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  it("runs migrations against the tmp DB so auth + user_profile tables exist", async () => {
    const { schema } = await import("@wardrobe-assistants/db/schema");
    // Sanity: querying these tables must succeed against the migrated schema.
    // If iter-14's user_profile migration ever falls out of the journal,
    // this assertion blows up before any consumer sees it.
    await expect(harness.db.select().from(schema.user)).resolves.toBeDefined();
    await expect(
      harness.db.select().from(schema.userProfile),
    ).resolves.toBeDefined();
  });

  it("signUpAndSignIn round-trips a session cookie usable by getSession", async () => {
    const cookies = await harness.signUpAndSignIn({
      email: "harness-1@test.local",
      password: "Sup3rSecure!Pass",
    });
    expect(cookies.get("cookie")).toBeTruthy();
    const session = await harness.auth.api.getSession({ headers: cookies });
    expect(session?.user.email).toBe("harness-1@test.local");
  });

  it("seedAdmin attaches an ADMIN user_profile to the auth user", async () => {
    const { schema } = await import("@wardrobe-assistants/db/schema");
    const { eq } = await import("drizzle-orm");
    const { userId } = await harness.seedAdmin({
      email: "harness-admin@test.local",
      password: "Sup3rSecure!Pass",
      firstName: "Harness",
      lastName: "Admin",
    });
    const rows = await harness.db
      .select()
      .from(schema.userProfile)
      .where(eq(schema.userProfile.userId, userId))
      .limit(1);
    expect(rows[0]?.role).toBe("ADMIN");
    expect(rows[0]?.status).toBe("verified");
  });

  it("seedSquadMember attaches a SQUAD_MEMBER profile", async () => {
    const { schema } = await import("@wardrobe-assistants/db/schema");
    const { eq } = await import("drizzle-orm");
    const { userId } = await harness.seedSquadMember({
      email: "harness-sm@test.local",
      password: "Sup3rSecure!Pass",
    });
    const rows = await harness.db
      .select()
      .from(schema.userProfile)
      .where(eq(schema.userProfile.userId, userId))
      .limit(1);
    expect(rows[0]?.role).toBe("SQUAD_MEMBER");
  });

  it("runAs swaps activeCookies for the duration of the inner fn", async () => {
    const cookies = await harness.signUpAndSignIn({
      email: "harness-runas@test.local",
      password: "Sup3rSecure!Pass",
    });
    expect(harness.activeCookies().get("cookie")).toBeNull();
    await harness.runAs(cookies, async () => {
      expect(harness.activeCookies().get("cookie")).toBe(cookies.get("cookie"));
    });
    expect(harness.activeCookies().get("cookie")).toBeNull();
  });
});
