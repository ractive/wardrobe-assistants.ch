// @vitest-environment node
//
// iter-26 smoke test for the public booking-request route. Hits the real
// Drizzle path through `setupHarness`; mocks only the outbound notification
// surfaces (`@/lib/email` + `@/lib/push`) so we can assert dispatch without
// requiring SMTP/VAPID. The route is a pure Web Fetch handler — we invoke
// the exported `POST`/`OPTIONS` directly with a constructed `Request`.
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

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {}),
  sendTemplated: vi.fn(async () => {}),
  sendTemplatedBatch: vi.fn(async () => ({ sent: 0, failed: 0 })),
}));

vi.mock("@/lib/push", () => ({
  sendPush: vi.fn(async () => ({ sent: 0 })),
}));

const FIXED_IP = "203.0.113.42";
const ALLOWED_ORIGIN = "https://wardrobe-assistants.ch";

function buildPostRequest(overrides: {
  body?: Record<string, unknown>;
  origin?: string | null;
  ip?: string;
}): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (overrides.origin !== null && overrides.origin !== undefined) {
    headers.set("origin", overrides.origin);
  }
  headers.set("x-forwarded-for", overrides.ip ?? FIXED_IP);
  return new Request("http://localhost/api/public/booking-requests", {
    method: "POST",
    headers,
    body: JSON.stringify(overrides.body ?? {}),
  });
}

function validBody(
  extra?: Partial<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    customerName: "Ada Lovelace",
    customerEmail: "ada@example.com",
    customerPhone: "+41 79 000 00 00",
    date: "2027-06-01",
    startTime: "18:00",
    durationHours: 6,
    venue: "Studio X",
    city: "Zurich",
    serviceSelections: [{ serviceId: "__placeholder__", quantity: 2 }],
    comment: "Press night.",
    formLoadedAt: Date.now() - 5_000,
    honeypot: "",
    token: "wa-booking-v1",
    ...extra,
  };
}

async function seedService(opts?: { archived?: boolean; name?: string }) {
  const { services } = await import("@wardrobe-assistants/db/schema");
  const { ulid } = await import("ulid");
  const id = ulid();
  await harness.db.insert(services).values({
    id,
    name: opts?.name ?? "Quick changes",
    description: null,
    priceType: "hourly",
    price: 100,
    archived: opts?.archived ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

describe("public booking-requests route — smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  beforeEach(async () => {
    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();
    const email = await import("@/lib/email");
    (email.sendTemplated as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it("OPTIONS — allowed origin returns 204 with CORS headers", async () => {
    const { OPTIONS } = await import("./route");
    const res = await OPTIONS(
      new Request("http://localhost/api/public/booking-requests", {
        method: "OPTIONS",
        headers: { origin: ALLOWED_ORIGIN },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("OPTIONS — disallowed origin returns 403", async () => {
    const { OPTIONS } = await import("./route");
    const res = await OPTIONS(
      new Request("http://localhost/api/public/booking-requests", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("POST — honeypot non-empty is rejected", async () => {
    const { POST } = await import("./route");
    const svc = await seedService();
    const res = await POST(
      buildPostRequest({
        origin: ALLOWED_ORIGIN,
        body: validBody({
          honeypot: "i am a bot",
          serviceSelections: [{ serviceId: svc, quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(400);
    const { bookings } = await import("@wardrobe-assistants/db/schema");
    const rows = await harness.db.select().from(bookings);
    expect(rows.length).toBe(0);
  });

  it("POST — time-check < 2s is rejected", async () => {
    const { POST } = await import("./route");
    const svc = await seedService();
    const res = await POST(
      buildPostRequest({
        origin: ALLOWED_ORIGIN,
        body: validBody({
          formLoadedAt: Date.now() - 500,
          serviceSelections: [{ serviceId: svc, quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST — wrong token is rejected", async () => {
    const { POST } = await import("./route");
    const svc = await seedService();
    const res = await POST(
      buildPostRequest({
        origin: ALLOWED_ORIGIN,
        body: validBody({
          token: "wrong",
          serviceSelections: [{ serviceId: svc, quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST — unknown serviceId is rejected", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      buildPostRequest({
        origin: ALLOWED_ORIGIN,
        body: validBody({
          serviceSelections: [{ serviceId: "does-not-exist", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST — archived serviceId is rejected", async () => {
    const { POST } = await import("./route");
    const archived = await seedService({ archived: true, name: "Old kit" });
    const res = await POST(
      buildPostRequest({
        origin: ALLOWED_ORIGIN,
        body: validBody({
          serviceSelections: [{ serviceId: archived, quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST — disallowed origin returns 403", async () => {
    const { POST } = await import("./route");
    const svc = await seedService();
    const res = await POST(
      buildPostRequest({
        origin: "https://evil.example",
        body: validBody({
          serviceSelections: [{ serviceId: svc, quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("POST — valid submission creates a public booking + selections + fires notifications", async () => {
    const { POST } = await import("./route");
    const { bookings, bookingServiceSelection } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const email = await import("@/lib/email");

    // Seed a verified admin so notifyAdmins has a recipient.
    await harness.seedAdmin({
      email: "admin-public@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const svc = await seedService();
    const res = await POST(
      buildPostRequest({
        origin: ALLOWED_ORIGIN,
        body: validBody({
          customerEmail: "Customer@Example.COM",
          serviceSelections: [{ serviceId: svc, quantity: 3 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const allBookings = await harness.db.select().from(bookings);
    expect(allBookings.length).toBe(1);
    const booking = allBookings[0];
    if (!booking) throw new Error("expected one booking");
    expect(booking.createdBy).toBeNull();
    expect(booking.status).toBe("created");
    expect(booking.customerEmail).toBe("customer@example.com");

    const sels = await harness.db
      .select()
      .from(bookingServiceSelection)
      .where(eq(bookingServiceSelection.bookingId, booking.id));
    expect(sels.length).toBe(1);
    expect(sels[0]?.quantity).toBe(3);

    // Yield once so the fire-and-forget notifications resolve before assert.
    await new Promise((r) => setTimeout(r, 0));

    const sendTemplatedMock = email.sendTemplated as unknown as ReturnType<
      typeof vi.fn
    >;
    // At minimum: one autoreply to customer + one to the admin via notifyUser.
    const calls = sendTemplatedMock.mock.calls.map((c) => c[0] as string);
    expect(calls).toContain("bookingRequestReceived");
    expect(calls).toContain("bookingRequested");
  });

  it("POST — 4th request from the same IP within an hour returns 429 with Retry-After", async () => {
    const { POST } = await import("./route");
    const svc = await seedService();
    const ip = "198.51.100.10";

    for (let i = 0; i < 3; i++) {
      const res = await POST(
        buildPostRequest({
          origin: ALLOWED_ORIGIN,
          ip,
          body: validBody({
            customerEmail: `user${i}@example.com`,
            serviceSelections: [{ serviceId: svc, quantity: 1 }],
          }),
        }),
      );
      expect(res.status).toBe(200);
    }
    const res = await POST(
      buildPostRequest({
        origin: ALLOWED_ORIGIN,
        ip,
        body: validBody({
          customerEmail: "user4@example.com",
          serviceSelections: [{ serviceId: svc, quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});
