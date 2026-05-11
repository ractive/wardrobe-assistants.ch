// @vitest-environment node
//
// iter-26 smoke test for the public services catalog route. Confirms archived
// services are excluded and CORS preflight responds correctly.
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { type Harness, setupHarness } from "@/test/http-harness";

let harness: Harness;

vi.mock("server-only", () => ({}));

const ALLOWED_ORIGIN = "https://wardrobe-assistants.ch";

describe("public services route — smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  beforeEach(async () => {
    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();
  });

  it("OPTIONS — allowed origin gets CORS headers", async () => {
    const { OPTIONS } = await import("./route");
    const res = await OPTIONS(
      new Request("http://localhost/api/public/services", {
        method: "OPTIONS",
        headers: { origin: ALLOWED_ORIGIN },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
  });

  it("OPTIONS — disallowed origin gets 403", async () => {
    const { OPTIONS } = await import("./route");
    const res = await OPTIONS(
      new Request("http://localhost/api/public/services", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("GET — returns only non-archived services", async () => {
    const { services } = await import("@wardrobe-assistants/db/schema");
    const { ulid } = await import("ulid");
    const liveId = ulid();
    const archivedId = ulid();
    await harness.db.insert(services).values([
      {
        id: liveId,
        name: "Live service",
        description: "Active",
        priceType: "hourly",
        price: 80,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: archivedId,
        name: "Old service",
        description: "Retired",
        priceType: "fixed",
        price: 30,
        archived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/public/services", {
        method: "GET",
        headers: { origin: ALLOWED_ORIGIN, "x-forwarded-for": "203.0.113.1" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      services: Array<{ id: string; name: string }>;
    };
    const ids = body.services.map((s) => s.id);
    expect(ids).toContain(liveId);
    expect(ids).not.toContain(archivedId);
  });
});
