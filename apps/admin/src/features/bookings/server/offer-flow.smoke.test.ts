// @vitest-environment node
//
// Smoke tests for iter-27 offer flow: sendOffer, public acceptOffer,
// adminAcceptOffer (offered→accepted), audit rows, rate-limit bucket shape.
// Real auth + Drizzle + in-process libSQL. Mocks: next/headers, next/cache,
// server-only, @/lib/email, @/lib/push.
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

vi.mock("@/lib/push", () => ({
  sendPush: vi.fn(async () => ({ sent: 0 })),
}));

// iter-37 §C.3: startTime, durationHours, venueCity are now required on new
// bookings (app-layer validation). All smoke test fixtures must supply them.
const optionalBookingFields = {
  notes: undefined,
  customerName: undefined,
  customerEmail: undefined,
  customerPhone: undefined,
  startTime: "18:00",
  durationHours: 8,
  venueName: undefined,
  venueCity: "Zurich",
  comment: undefined,
} as const;

describe("offer flow — smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  // -------------------------------------------------------------------------
  // sendOffer happy path
  // -------------------------------------------------------------------------

  it("sendOffer: happy path — snapshot rows, status transition, email queued", async () => {
    const admin = await harness.seedAdmin({
      email: "offer-admin1@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, sendOffer, replaceBookingSelections } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");
    const { services } = await import("@wardrobe-assistants/db/schema");
    const { ulid } = await import("ulid");
    const { sendTemplated } = await import("@/lib/email");
    const sendMock = sendTemplated as unknown as ReturnType<typeof vi.fn>;
    sendMock.mockClear();

    const svcId = ulid();
    await harness.db.insert(services).values({
      id: svcId,
      name: "Fitting",
      description: "Full costume fitting.",
      priceType: "fixed",
      price: 120,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Offer happy-path booking",
        date: new Date("2026-11-01T18:00:00.000Z"),
        venue: "Studio Offer",
        ...optionalBookingFields,
        customerEmail: "customer@example.com",
        customerName: "Test Customer",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Offer happy-path booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: svcId, quantity: 2 }],
      }),
    );

    const result = await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    // Status should now be "offered".
    const { bookings, bookingServiceItem } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const bookingRows = await harness.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(bookingRows[0]?.status).toBe("offered");
    expect(bookingRows[0]?.offerVersion).toBe(1);
    expect(bookingRows[0]?.lastOfferSentAt).not.toBeNull();

    // Snapshot items should exist at offerVersion=1.
    const items = await harness.db
      .select()
      .from(bookingServiceItem)
      .where(eq(bookingServiceItem.bookingId, booking.id));
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Fitting");
    expect(items[0]?.unitPrice).toBe(120);
    expect(items[0]?.quantity).toBe(2);
    expect(items[0]?.total).toBe(240);
    expect(items[0]?.offerVersion).toBe(1);

    // Customer offer email should have been sent.
    expect(sendMock).toHaveBeenCalledWith(
      "offerSent",
      "customer@example.com",
      expect.objectContaining({ offerVersion: 1 }),
    );
  });

  // -------------------------------------------------------------------------
  // sendOffer guard: non-created status
  // -------------------------------------------------------------------------

  it("sendOffer: fails on non-created booking status", async () => {
    const admin = await harness.seedAdmin({
      email: "offer-admin2@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, sendOffer, adminAcceptOffer } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Offer guard-status booking",
        date: new Date("2026-11-02T18:00:00.000Z"),
        venue: "Studio Guard",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Offer guard-status booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    // Move to accepted first.
    await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );

    const result = await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/accepted|created/i);
  });

  // -------------------------------------------------------------------------
  // sendOffer guard: zero selections
  // -------------------------------------------------------------------------

  it("sendOffer: fails when no selections exist", async () => {
    const admin = await harness.seedAdmin({
      email: "offer-admin3@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, sendOffer } = await import("./actions");
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Offer no-selections booking",
        date: new Date("2026-11-03T18:00:00.000Z"),
        venue: "Studio Empty",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Offer no-selections booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    const result = await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/line item|selection/i);
  });

  // -------------------------------------------------------------------------
  // sendOffer permission guard
  // -------------------------------------------------------------------------

  it("sendOffer: squad member is denied — BOOKING_OFFER_SEND required", async () => {
    const sm = await harness.seedSquadMember({
      email: "offer-sm1@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { sendOffer } = await import("./actions");
    await expect(
      harness.runAs(sm.cookies, () => sendOffer({ bookingId: "any" })),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  // -------------------------------------------------------------------------
  // acceptOffer (customer path) happy path
  // -------------------------------------------------------------------------

  it("acceptOffer: happy path — offered→accepted, audit row, notifyAdmins called", async () => {
    const admin = await harness.seedAdmin({
      email: "offer-admin4@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, sendOffer, replaceBookingSelections } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");
    const { services, bookings, auditLog } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");
    const { ulid } = await import("ulid");

    const svc2Id = ulid();
    await harness.db.insert(services).values({
      id: svc2Id,
      name: "Styling",
      description: "Event styling.",
      priceType: "fixed",
      price: 200,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Accept customer-path booking",
        date: new Date("2026-11-04T18:00:00.000Z"),
        venue: "Studio Accept",
        ...optionalBookingFields,
        customerEmail: "cust2@example.com",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Accept customer-path booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: svc2Id, quantity: 1 }],
      }),
    );
    await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );

    // Fetch the offer token.
    const bookingRows = await harness.db
      .select({ offerToken: bookings.offerToken })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    const token = bookingRows[0]?.offerToken;
    expect(token).toBeDefined();
    if (!token) return;

    // Stub headers() for the public action (no auth, keyed by IP).
    const { acceptOffer } = await import(
      "../../../app/(public)/offer/[token]/actions"
    );

    // Reset rate-limit store so this test isn't blocked by the one above.
    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();

    const result = await acceptOffer(token, true);
    expect(result.error, JSON.stringify(result)).toBe(false);

    // Booking status should now be "accepted".
    const updatedRows = await harness.db
      .select({ status: bookings.status, acceptedAt: bookings.acceptedAt })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(updatedRows[0]?.status).toBe("accepted");
    expect(updatedRows[0]?.acceptedAt).not.toBeNull();

    // Audit row should exist.
    const auditRows = await harness.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetId, booking.id),
          eq(auditLog.action, "booking.offer.accepted"),
        ),
      );
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    const customerAudit = auditRows.find((r) => r.actorUserId === "customer");
    expect(customerAudit).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // acceptOffer: T&C not agreed
  // -------------------------------------------------------------------------

  it("acceptOffer: returns error when agreedToTerms is false", async () => {
    const { acceptOffer } = await import(
      "../../../app/(public)/offer/[token]/actions"
    );
    const result = await acceptOffer("any-token", false);
    expect(result.error).toBe(true);
    if (result.error) {
      expect(result.message).toMatch(/terms/i);
    }
  });

  // -------------------------------------------------------------------------
  // acceptOffer: non-offered status
  // -------------------------------------------------------------------------

  it("acceptOffer: returns error when booking is not in offered state", async () => {
    const admin = await harness.seedAdmin({
      email: "offer-admin5@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking } = await import("./actions");
    const { listBookings } = await import("./queries");
    const { bookings } = await import("@wardrobe-assistants/db/schema");
    const { eq } = await import("drizzle-orm");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Not-offered booking",
        date: new Date("2026-11-05T18:00:00.000Z"),
        venue: "Studio NotOffered",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Not-offered booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    // Get the offer token from the created booking.
    const tokenRows = await harness.db
      .select({ offerToken: bookings.offerToken })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    const token = tokenRows[0]?.offerToken;
    expect(token).toBeDefined();
    if (!token) return;

    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();

    const { acceptOffer } = await import(
      "../../../app/(public)/offer/[token]/actions"
    );
    const result = await acceptOffer(token, true);
    expect(result.error).toBe(true);
    if (result.error) {
      expect(result.message).toMatch(/acceptable state|offered/i);
    }
  });

  // -------------------------------------------------------------------------
  // adminAcceptOffer: offered→accepted (no new snapshot)
  // -------------------------------------------------------------------------

  it("adminAcceptOffer: offered→accepted uses existing snapshot, no re-snapshot", async () => {
    const admin = await harness.seedAdmin({
      email: "offer-admin6@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const {
      createBooking,
      sendOffer,
      adminAcceptOffer,
      replaceBookingSelections,
    } = await import("./actions");
    const { listBookings } = await import("./queries");
    const { services, bookings, bookingServiceItem } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const { ulid } = await import("ulid");

    const svc3Id = ulid();
    await harness.db.insert(services).values({
      id: svc3Id,
      name: "Alterations",
      description: "Costume alterations.",
      priceType: "fixed",
      price: 80,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Admin-accept offered booking",
        date: new Date("2026-11-06T18:00:00.000Z"),
        venue: "Studio AdminAccept",
        ...optionalBookingFields,
        customerEmail: "cust3@example.com",
        customerName: "Admin Accept Customer",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Admin-accept offered booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: svc3Id, quantity: 1 }],
      }),
    );

    // Send offer: creates snapshot at offerVersion=1.
    await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );

    const itemsBefore = await harness.db
      .select()
      .from(bookingServiceItem)
      .where(eq(bookingServiceItem.bookingId, booking.id));
    expect(itemsBefore).toHaveLength(1);

    // Admin accepts on behalf of the customer.
    const result = await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    // Status accepted.
    const bookingRows = await harness.db
      .select({
        status: bookings.status,
        offerVersion: bookings.offerVersion,
      })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(bookingRows[0]?.status).toBe("accepted");
    expect(bookingRows[0]?.offerVersion).toBe(1);

    // No new snapshot row — still 1 item.
    const itemsAfter = await harness.db
      .select()
      .from(bookingServiceItem)
      .where(eq(bookingServiceItem.bookingId, booking.id));
    expect(itemsAfter).toHaveLength(1);

    // offerAcceptedAdmin customer email should have been sent.
    const { sendTemplated } = await import("@/lib/email");
    const sendMock = sendTemplated as unknown as ReturnType<typeof vi.fn>;
    const offerAcceptedAdminCall = sendMock.mock.calls.find(
      (args: unknown[]) => args[0] === "offerAcceptedAdmin",
    );
    expect(offerAcceptedAdminCall).toBeDefined();
    expect(offerAcceptedAdminCall?.[1]).toBe("cust3@example.com");
  });

  // -------------------------------------------------------------------------
  // Rate limit: offerAccept bucket shape
  // -------------------------------------------------------------------------

  it("offerAccept rate-limit bucket has limit=10 and windowMs=1h", async () => {
    const { RATE_LIMITS } = await import("@/lib/rate-limit");
    expect(RATE_LIMITS.offerAccept.limit).toBe(10);
    expect(RATE_LIMITS.offerAccept.windowMs).toBe(60 * 60 * 1000);
  });

  // -------------------------------------------------------------------------
  // Rate limit: offerView bucket shape
  // -------------------------------------------------------------------------

  it("offerView rate-limit bucket has limit=60 and windowMs=1min", async () => {
    const { RATE_LIMITS } = await import("@/lib/rate-limit");
    expect(RATE_LIMITS.offerView.limit).toBe(60);
    expect(RATE_LIMITS.offerView.windowMs).toBe(60 * 1000);
  });

  // -------------------------------------------------------------------------
  // Mailto link correctness (unit-level check on URL encoding)
  // -------------------------------------------------------------------------

  it("mailto link encodes booking ID and offer version correctly", () => {
    const bookingId = "01HXYZ";
    const offerVersion = 3;
    const mailtoSubject = encodeURIComponent(
      `Question about booking ${bookingId} (offer v${offerVersion})`,
    );
    const mailtoBody = encodeURIComponent(
      `Hi,\n\nI have a question about offer v${offerVersion} for booking ${bookingId}:\n\n`,
    );
    const mailtoHref = `mailto:info@wardrobe-assistants.ch?subject=${mailtoSubject}&body=${mailtoBody}`;

    expect(mailtoHref).toContain("01HXYZ");
    expect(mailtoHref).toContain("offer%20v3");
    expect(mailtoHref).not.toMatch(/[\r\n]/);
  });

  // =========================================================================
  // iter-28 smoke tests
  // =========================================================================

  // -------------------------------------------------------------------------
  // sendRevisedOffer: from offered state
  // -------------------------------------------------------------------------

  it("sendRevisedOffer: offered→offered — new snapshot, prior archived, email queued", async () => {
    const admin = await harness.seedAdmin({
      email: "revise-admin1@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const {
      createBooking,
      sendOffer,
      sendRevisedOffer,
      replaceBookingSelections,
    } = await import("./actions");
    const { listBookings } = await import("./queries");
    const { services, bookings, bookingServiceItem, auditLog } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");
    const { ulid } = await import("ulid");
    const { sendTemplated } = await import("@/lib/email");
    const sendMock = sendTemplated as unknown as ReturnType<typeof vi.fn>;
    sendMock.mockClear();

    const svcId = ulid();
    await harness.db.insert(services).values({
      id: svcId,
      name: "Revise-Fitting",
      description: "Fitting.",
      priceType: "fixed",
      price: 100,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Revise-from-offered booking",
        date: new Date("2027-01-10T18:00:00.000Z"),
        venue: "Studio Revise",
        ...optionalBookingFields,
        customerEmail: "revise-cust1@example.com",
        customerName: "Revise Customer",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Revise-from-offered booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: svcId, quantity: 1 }],
      }),
    );
    await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );

    // Confirm we're at v1 offered.
    const v1Rows = await harness.db
      .select({ offerVersion: bookings.offerVersion, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(v1Rows[0]?.status).toBe("offered");
    expect(v1Rows[0]?.offerVersion).toBe(1);

    sendMock.mockClear();

    const result = await harness.runAs(admin.cookies, () =>
      sendRevisedOffer({ bookingId: booking.id }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    // Status stays offered, version increments.
    const v2Rows = await harness.db
      .select({
        offerVersion: bookings.offerVersion,
        status: bookings.status,
        acceptedAt: bookings.acceptedAt,
      })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(v2Rows[0]?.status).toBe("offered");
    expect(v2Rows[0]?.offerVersion).toBe(2);
    expect(v2Rows[0]?.acceptedAt).toBeNull();

    // Two snapshot versions should now exist.
    const items = await harness.db
      .select({ offerVersion: bookingServiceItem.offerVersion })
      .from(bookingServiceItem)
      .where(eq(bookingServiceItem.bookingId, booking.id));
    const versions = items.map((r) => r.offerVersion);
    expect(versions).toContain(1);
    expect(versions).toContain(2);

    // Audit: snapshot.archived row should exist.
    const archivedRows = await harness.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetId, booking.id),
          eq(auditLog.action, "booking.offer.snapshot.archived"),
        ),
      );
    expect(archivedRows.length).toBeGreaterThanOrEqual(1);

    // Audit: offer.revised row should exist.
    const revisedRows = await harness.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetId, booking.id),
          eq(auditLog.action, "booking.offer.revised"),
        ),
      );
    expect(revisedRows.length).toBeGreaterThanOrEqual(1);

    // offerRevised email sent to customer.
    expect(sendMock).toHaveBeenCalledWith(
      "offerRevised",
      "revise-cust1@example.com",
      expect.objectContaining({ offerVersion: 2, wasAccepted: false }),
    );
  });

  // -------------------------------------------------------------------------
  // sendRevisedOffer: from accepted state
  // -------------------------------------------------------------------------

  it("sendRevisedOffer: accepted→offered — clears acceptedAt, wasAccepted=true in email", async () => {
    const admin = await harness.seedAdmin({
      email: "revise-admin2@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const {
      createBooking,
      sendOffer,
      sendRevisedOffer,
      replaceBookingSelections,
    } = await import("./actions");
    const { listBookings } = await import("./queries");
    const { services, bookings } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const { ulid } = await import("ulid");
    const { sendTemplated } = await import("@/lib/email");
    const sendMock = sendTemplated as unknown as ReturnType<typeof vi.fn>;
    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();

    const svcId = ulid();
    await harness.db.insert(services).values({
      id: svcId,
      name: "Revise-Styling",
      description: "Styling.",
      priceType: "fixed",
      price: 150,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Revise-from-accepted booking",
        date: new Date("2027-01-11T18:00:00.000Z"),
        venue: "Studio ReviseA",
        ...optionalBookingFields,
        customerEmail: "revise-cust2@example.com",
        customerName: "Revise Accepted Customer",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Revise-from-accepted booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: svcId, quantity: 1 }],
      }),
    );
    await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );

    // Customer accepts.
    const bookingRow = await harness.db
      .select({ offerToken: bookings.offerToken })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    const token = bookingRow[0]?.offerToken;
    expect(token).toBeDefined();
    if (!token) return;

    const { acceptOffer } = await import(
      "../../../app/(public)/offer/[token]/actions"
    );
    await acceptOffer(token, true);

    // Confirm accepted.
    const acceptedRow = await harness.db
      .select({ status: bookings.status, acceptedAt: bookings.acceptedAt })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(acceptedRow[0]?.status).toBe("accepted");
    expect(acceptedRow[0]?.acceptedAt).not.toBeNull();

    sendMock.mockClear();

    const result = await harness.runAs(admin.cookies, () =>
      sendRevisedOffer({ bookingId: booking.id }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    // Status flips back to offered, acceptedAt cleared.
    const afterRow = await harness.db
      .select({
        status: bookings.status,
        offerVersion: bookings.offerVersion,
        acceptedAt: bookings.acceptedAt,
      })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(afterRow[0]?.status).toBe("offered");
    expect(afterRow[0]?.offerVersion).toBe(2);
    expect(afterRow[0]?.acceptedAt).toBeNull();

    // Email sent with wasAccepted=true.
    expect(sendMock).toHaveBeenCalledWith(
      "offerRevised",
      "revise-cust2@example.com",
      expect.objectContaining({ wasAccepted: true }),
    );
  });

  // -------------------------------------------------------------------------
  // sendRevisedOffer: non-revisable status (created)
  // -------------------------------------------------------------------------

  it("sendRevisedOffer: fails when booking is in created state", async () => {
    const admin = await harness.seedAdmin({
      email: "revise-admin3@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, sendRevisedOffer } = await import("./actions");
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Revise-terminal booking",
        date: new Date("2027-01-12T18:00:00.000Z"),
        venue: "Studio Terminal",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Revise-terminal booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    // 'created' is neither 'offered' nor 'accepted', so revision must reject.
    const result = await harness.runAs(admin.cookies, () =>
      sendRevisedOffer({ bookingId: booking.id }),
    );
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/created/i);
  });

  // -------------------------------------------------------------------------
  // rejectOffer: customer declines from offered
  // -------------------------------------------------------------------------

  it("rejectOffer: offered→rejected, audit via=customer, admin notified", async () => {
    const admin = await harness.seedAdmin({
      email: "reject-offer-admin1@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, sendOffer, replaceBookingSelections } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");
    const { services, bookings, auditLog } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");
    const { ulid } = await import("ulid");
    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();

    const svcId = ulid();
    await harness.db.insert(services).values({
      id: svcId,
      name: "Reject-Fitting",
      description: "Fitting.",
      priceType: "fixed",
      price: 80,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "RejectOffer booking",
        date: new Date("2027-02-01T18:00:00.000Z"),
        venue: "Studio Reject",
        ...optionalBookingFields,
        customerEmail: "reject-cust1@example.com",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "RejectOffer booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: svcId, quantity: 1 }],
      }),
    );
    await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );

    const tokenRow = await harness.db
      .select({ offerToken: bookings.offerToken })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    const token = tokenRow[0]?.offerToken;
    expect(token).toBeDefined();
    if (!token) return;

    const { rejectOffer } = await import(
      "../../../app/(public)/offer/[token]/actions"
    );
    const result = await rejectOffer(token, "Price too high");
    expect(result.error, JSON.stringify(result)).toBe(false);

    // Status should be rejected.
    const afterRow = await harness.db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(afterRow[0]?.status).toBe("rejected");

    // Audit row: via=customer, reason recorded.
    const auditRows = await harness.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetId, booking.id),
          eq(auditLog.action, "booking.offer.rejected"),
        ),
      );
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    const parsed: unknown = JSON.parse(auditRows[0]?.metadata ?? "{}");
    expect(parsed).toMatchObject({ via: "customer", reason: "Price too high" });
  });

  // -------------------------------------------------------------------------
  // rejectOffer: non-offered → error
  // -------------------------------------------------------------------------

  it("rejectOffer: returns error when booking is not in offered state", async () => {
    const admin = await harness.seedAdmin({
      email: "reject-offer-admin2@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking } = await import("./actions");
    const { listBookings } = await import("./queries");
    const { bookings } = await import("@wardrobe-assistants/db/schema");
    const { eq } = await import("drizzle-orm");
    const { _resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
    _resetRateLimitStoreForTests();

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "RejectOffer not-offered booking",
        date: new Date("2027-02-02T18:00:00.000Z"),
        venue: "Studio NotOffered2",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find(
      (b) => b.name === "RejectOffer not-offered booking",
    );
    expect(booking).toBeDefined();
    if (!booking) return;

    const tokenRow = await harness.db
      .select({ offerToken: bookings.offerToken })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    const token = tokenRow[0]?.offerToken;
    expect(token).toBeDefined();
    if (!token) return;

    const { rejectOffer } = await import(
      "../../../app/(public)/offer/[token]/actions"
    );
    const result = await rejectOffer(token);
    expect(result.error).toBe(true);
    if (result.error) {
      expect(result.message).toMatch(/declinable|offered/i);
    }
  });

  // -------------------------------------------------------------------------
  // rejectBooking: from offered state (admin)
  // -------------------------------------------------------------------------

  it("rejectBooking: offered→rejected works; accepted→rejected is blocked", async () => {
    const admin = await harness.seedAdmin({
      email: "reject-booking-admin1@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const {
      createBooking,
      sendOffer,
      rejectBooking,
      adminAcceptOffer,
      replaceBookingSelections,
    } = await import("./actions");
    const { listBookings } = await import("./queries");
    const { services, bookings } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const { ulid } = await import("ulid");

    const svcId = ulid();
    await harness.db.insert(services).values({
      id: svcId,
      name: "AdminReject-Fitting",
      description: "Fitting.",
      priceType: "fixed",
      price: 90,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Test offered → rejected.
    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "AdminReject-offered booking",
        date: new Date("2027-03-01T18:00:00.000Z"),
        venue: "Studio AdminReject",
        ...optionalBookingFields,
        customerEmail: "admin-reject-cust@example.com",
      }),
    );
    const list1 = await harness.runAs(admin.cookies, () => listBookings());
    const offered = list1.find((b) => b.name === "AdminReject-offered booking");
    expect(offered).toBeDefined();
    if (!offered) return;

    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: offered.id,
        selections: [{ serviceId: svcId, quantity: 1 }],
      }),
    );
    await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: offered.id }),
    );

    const r1 = await harness.runAs(admin.cookies, () =>
      rejectBooking({ bookingId: offered.id, reason: undefined }),
    );
    expect(r1.error, JSON.stringify(r1)).toBe(false);

    const afterRow = await harness.db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, offered.id))
      .limit(1);
    expect(afterRow[0]?.status).toBe("rejected");

    // Test accepted → reject is blocked.
    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "AdminReject-accepted booking",
        date: new Date("2027-03-02T18:00:00.000Z"),
        venue: "Studio AdminRejectAcc",
        ...optionalBookingFields,
      }),
    );
    const list2 = await harness.runAs(admin.cookies, () => listBookings());
    const accepted = list2.find(
      (b) => b.name === "AdminReject-accepted booking",
    );
    expect(accepted).toBeDefined();
    if (!accepted) return;

    await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: accepted.id }),
    );

    const r2 = await harness.runAs(admin.cookies, () =>
      rejectBooking({ bookingId: accepted.id, reason: undefined }),
    );
    expect(r2.error).toBe(true);
  });

  // -------------------------------------------------------------------------
  // cancelBooking: only notifies confirmed/assigned squad members
  // -------------------------------------------------------------------------

  it("cancelBooking: only notifies assigned/confirmed squad — not withdrawn", async () => {
    const admin = await harness.seedAdmin({
      email: "cancel-notify-admin@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm1 = await harness.seedSquadMember({
      email: "cancel-sm1@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm2 = await harness.seedSquadMember({
      email: "cancel-sm2@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const {
      createBooking,
      adminAcceptOffer,
      cancelBooking,
      assignUser,
      unassignUser,
    } = await import("./actions");
    const { listBookings } = await import("./queries");
    const { bookingAssignments } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const { sendPush } = await import("@/lib/push");
    const pushMock = sendPush as unknown as ReturnType<typeof vi.fn>;
    pushMock.mockClear();

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Cancel-notify-squad booking",
        date: new Date("2027-04-01T18:00:00.000Z"),
        venue: "Studio CancelNotify",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Cancel-notify-squad booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );

    // Assign both squad members.
    await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: booking.id, userId: sm1.userId }),
    );
    await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: booking.id, userId: sm2.userId }),
    );

    // Unassign sm2 to simulate withdrawal (status goes to a non-assigned state).
    await harness.runAs(admin.cookies, () =>
      unassignUser({ bookingId: booking.id, userId: sm2.userId }),
    );

    // Confirm sm1 is assigned, sm2 is gone.
    const assignments = await harness.db
      .select()
      .from(bookingAssignments)
      .where(eq(bookingAssignments.bookingId, booking.id));
    const sm1Assignment = assignments.find((a) => a.userId === sm1.userId);
    expect(sm1Assignment?.status).toBe("assigned");
    expect(assignments.find((a) => a.userId === sm2.userId)).toBeUndefined();

    pushMock.mockClear();

    const result = await harness.runAs(admin.cookies, () =>
      cancelBooking({ bookingId: booking.id, reason: undefined }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    // Only sm1 should have received a push notification.
    const pushCalls = (pushMock.mock.calls as Array<[string, unknown]>).filter(
      ([userId]) => userId === sm1.userId || userId === sm2.userId,
    );
    const sm1Notified = pushCalls.some(([uid]) => uid === sm1.userId);
    const sm2Notified = pushCalls.some(([uid]) => uid === sm2.userId);
    expect(sm1Notified).toBe(true);
    expect(sm2Notified).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Selection editor: edits in offered/accepted don't alter customer snapshot
  // -------------------------------------------------------------------------

  it("selection editor edits in offered/accepted don't change customer-facing snapshot", async () => {
    const admin = await harness.seedAdmin({
      email: "selection-edit-admin@offer-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, sendOffer, replaceBookingSelections } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");
    const { services, bookings, bookingServiceItem } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");
    const { ulid } = await import("ulid");

    const svc1Id = ulid();
    const svc2Id = ulid();
    await harness.db.insert(services).values([
      {
        id: svc1Id,
        name: "SelEdit-Fitting",
        description: "Fitting.",
        priceType: "fixed",
        price: 100,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: svc2Id,
        name: "SelEdit-Styling",
        description: "Styling.",
        priceType: "fixed",
        price: 200,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "SelectionEdit booking",
        date: new Date("2027-05-01T18:00:00.000Z"),
        venue: "Studio SelEdit",
        ...optionalBookingFields,
        customerEmail: "sel-edit-cust@example.com",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "SelectionEdit booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    // Add svc1 and send offer — snapshot at v1.
    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: svc1Id, quantity: 1 }],
      }),
    );
    await harness.runAs(admin.cookies, () =>
      sendOffer({ bookingId: booking.id }),
    );

    // Now in offered state. Admin edits selections to add svc2.
    const editResult = await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [
          { serviceId: svc1Id, quantity: 1 },
          { serviceId: svc2Id, quantity: 2 },
        ],
      }),
    );
    expect(editResult.error, JSON.stringify(editResult)).toBe(false);

    // Customer-facing snapshot (at offerVersion=1) must still be just svc1.
    const v1Items = await harness.db
      .select({ name: bookingServiceItem.name })
      .from(bookingServiceItem)
      .where(
        and(
          eq(bookingServiceItem.bookingId, booking.id),
          eq(bookingServiceItem.offerVersion, 1),
        ),
      );
    expect(v1Items).toHaveLength(1);
    expect(v1Items[0]?.name).toBe("SelEdit-Fitting");

    // Current booking version should still be 1 (no revised offer sent yet).
    const bookingRow = await harness.db
      .select({ offerVersion: bookings.offerVersion })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(bookingRow[0]?.offerVersion).toBe(1);
  });
});
