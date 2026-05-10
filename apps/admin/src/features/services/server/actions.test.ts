import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@/lib/permissions";

vi.mock("@/lib/permissions", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/permissions")>();
  return {
    ...real,
    withPermission: <TArgs extends unknown[], TResult>(
      _perm: Permission,
      action: (userId: string, ...args: TArgs) => Promise<TResult>,
    ) => {
      return (...args: TArgs) => action("actor-1", ...args);
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: makeDbMock() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: {} },
  getCurrentUserRole: async () => null,
  roleForUserId: async () => null,
}));

import { db } from "@/lib/db";
import { archiveService, createService, updateService } from "./actions";

function makeDbMock() {
  return {
    _insertImpl: vi.fn<(values: unknown) => Promise<unknown>>(),
    _updateReturning: [] as unknown[],
    insert() {
      const self = this;
      return {
        values(v: unknown) {
          const inserted = self._insertImpl(v);
          return {
            // biome-ignore lint/suspicious/noThenProperty: deliberately thenable to mirror Drizzle's query builder.
            then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
              return inserted.then(onF, onR);
            },
          };
        },
      };
    },
    update() {
      return {
        set: () => ({
          where: () => ({
            returning: async () => this._updateReturning,
          }),
        }),
      };
    },
  };
}

const dbMock = db as unknown as ReturnType<typeof makeDbMock>;

beforeEach(() => {
  dbMock._insertImpl = vi.fn(async () => undefined);
  dbMock._updateReturning = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createService", () => {
  const valid = {
    name: "Sewing kit",
    description: "Bring a portable sewing kit.",
    priceType: "fixed" as const,
    price: 25,
  };

  it("rejects invalid input (empty name)", async () => {
    const r = await createService({ ...valid, name: "" });
    expect(r.error).toBe(true);
  });

  it("rejects negative price", async () => {
    const r = await createService({ ...valid, price: -10 });
    expect(r.error).toBe(true);
  });

  it("rejects non-integer price", async () => {
    const r = await createService({ ...valid, price: 25.5 });
    expect(r.error).toBe(true);
  });

  it("inserts and returns success", async () => {
    const r = await createService(valid);
    expect(r).toEqual({ error: false, message: "Service created." });
    // 2 inserts: services row + audit_log row.
    expect(dbMock._insertImpl).toHaveBeenCalledTimes(2);
  });
});

describe("updateService", () => {
  const valid = {
    serviceId: "svc_1",
    name: "Sewing kit",
    description: "Updated.",
    priceType: "fixed" as const,
    price: 30,
  };

  it("rejects invalid input", async () => {
    const r = await updateService({ ...valid, name: "" });
    expect(r.error).toBe(true);
  });

  it("returns 'not found' when 0 rows affected", async () => {
    dbMock._updateReturning = [];
    const r = await updateService(valid);
    expect(r).toEqual({ error: true, message: "Service not found." });
  });

  it("succeeds when a row is updated", async () => {
    dbMock._updateReturning = [{ id: "svc_1" }];
    const r = await updateService(valid);
    expect(r).toEqual({ error: false, message: "Service updated." });
  });
});

describe("archiveService", () => {
  it("returns 'not found' when 0 rows affected", async () => {
    dbMock._updateReturning = [];
    const r = await archiveService({ serviceId: "missing" });
    expect(r).toEqual({ error: true, message: "Service not found." });
  });

  it("succeeds when a row is archived", async () => {
    dbMock._updateReturning = [{ id: "svc_1" }];
    const r = await archiveService({ serviceId: "svc_1" });
    expect(r).toEqual({ error: false, message: "Service archived." });
  });

  it("rejects empty serviceId", async () => {
    const r = await archiveService({ serviceId: "" });
    expect(r.error).toBe(true);
  });
});
