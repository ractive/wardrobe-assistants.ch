// @vitest-environment node
//
// Smoke test for the services feature — exercises the real auth + permission
// + Drizzle path. Mocks `next/headers`, `next/cache`, and `server-only`;
// everything else is real.
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

describe("services feature — smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  it("admin can create a service and it shows up in listServices()", async () => {
    const admin = await harness.seedAdmin({
      email: "admin1@services-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createService } = await import("./actions");
    const { listServices } = await import("./queries");

    const result = await harness.runAs(admin.cookies, () =>
      createService({
        name: "Sewing kit",
        description: "Bring a portable sewing kit.",
        priceType: "fixed",
        price: 25,
      }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    const list = await harness.runAs(admin.cookies, () => listServices());
    const found = list.find((s) => s.name === "Sewing kit");
    expect(found).toBeDefined();
    expect(found?.priceFormatted).toBe("CHF 25.-");
  });

  it("admin can update a service", async () => {
    const admin = await harness.seedAdmin({
      email: "admin2@services-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createService, updateService } = await import("./actions");
    const { listServices } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createService({
        name: "Hourly assistant",
        description: "On-site wardrobe support.",
        priceType: "hourly",
        price: 80,
      }),
    );
    const before = (
      await harness.runAs(admin.cookies, () => listServices())
    ).find((s) => s.name === "Hourly assistant");
    expect(before).toBeDefined();
    if (!before) return;

    const r = await harness.runAs(admin.cookies, () =>
      updateService({
        serviceId: before.id,
        name: "Hourly assistant",
        description: "On-site wardrobe support, expanded.",
        priceType: "hourly",
        price: 95,
      }),
    );
    expect(r.error).toBe(false);

    const after = (
      await harness.runAs(admin.cookies, () => listServices())
    ).find((s) => s.id === before.id);
    expect(after?.price).toBe(95);
    expect(after?.priceFormatted).toBe("CHF 95.-/h");
  });

  it("admin can archive a service — hidden by default, visible with toggle", async () => {
    const admin = await harness.seedAdmin({
      email: "admin3@services-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createService, archiveService } = await import("./actions");
    const { listServices } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createService({
        name: "Retiring service",
        description: "About to be archived.",
        priceType: "fixed",
        price: 50,
      }),
    );
    const svc = (await harness.runAs(admin.cookies, () => listServices())).find(
      (s) => s.name === "Retiring service",
    );
    expect(svc).toBeDefined();
    if (!svc) return;

    const r = await harness.runAs(admin.cookies, () =>
      archiveService({ serviceId: svc.id }),
    );
    expect(r.error).toBe(false);

    const activeOnly = await harness.runAs(admin.cookies, () => listServices());
    expect(activeOnly.map((s) => s.id)).not.toContain(svc.id);

    const all = await harness.runAs(admin.cookies, () =>
      listServices({ includeArchived: true }),
    );
    const archived = all.find((s) => s.id === svc.id);
    expect(archived?.archived).toBe(true);
  });

  it("squad member is denied SERVICE_CREATE — withPermission throws", async () => {
    const sm = await harness.seedSquadMember({
      email: "sm1@services-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createService } = await import("./actions");
    await expect(
      harness.runAs(sm.cookies, () =>
        createService({
          name: "Forbidden",
          description: "Should not be allowed.",
          priceType: "fixed",
          price: 10,
        }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  it("squad member is denied SERVICE_DELETE on archive", async () => {
    const admin = await harness.seedAdmin({
      email: "admin4@services-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "sm2@services-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createService, archiveService } = await import("./actions");
    const { listServices } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createService({
        name: "Sm-archive guard",
        description: "Will not be archived by squad.",
        priceType: "fixed",
        price: 15,
      }),
    );
    const svc = (await harness.runAs(admin.cookies, () => listServices())).find(
      (s) => s.name === "Sm-archive guard",
    );
    expect(svc).toBeDefined();
    if (!svc) return;

    await expect(
      harness.runAs(sm.cookies, () => archiveService({ serviceId: svc.id })),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  it("squad member is denied SERVICE_CREATE on update", async () => {
    const admin = await harness.seedAdmin({
      email: "admin5@services-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "sm3@services-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createService, updateService } = await import("./actions");
    const { listServices } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createService({
        name: "Sm-update guard",
        description: "Will not be updated by squad.",
        priceType: "fixed",
        price: 20,
      }),
    );
    const svc = (await harness.runAs(admin.cookies, () => listServices())).find(
      (s) => s.name === "Sm-update guard",
    );
    expect(svc).toBeDefined();
    if (!svc) return;

    await expect(
      harness.runAs(sm.cookies, () =>
        updateService({
          serviceId: svc.id,
          name: "hacked",
          description: "should fail",
          priceType: "fixed",
          price: 99,
        }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });
});
