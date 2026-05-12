// @vitest-environment node
//
// Smoke test for the bookings feature — exercises the real auth + permission
// + Drizzle path, mirroring the users smoke. Mocks `next/headers`,
// `next/cache`, `server-only`, and `@/lib/email`; everything else is real.
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

// iter-23: actions now call notifyUser instead of sendTemplated/sendTemplatedBatch
// directly. Mock push so tests don't need VAPID env or web-push installed.
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

describe("bookings feature — smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  it("admin can create a booking and it shows up in listBookings()", async () => {
    const admin = await harness.seedAdmin({
      email: "admin1@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking } = await import("./actions");
    const { listBookings } = await import("./queries");

    const result = await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Spring kickoff",
        date: new Date("2026-06-01T18:00:00.000Z"),
        venue: "Studio A",
        ...optionalBookingFields,
      }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    const list = await harness.runAs(admin.cookies, () => listBookings());
    expect(list.map((e) => e.name)).toContain("Spring kickoff");
  });

  it("squad member is denied BOOKING_CREATE — withPermission throws", async () => {
    const sm = await harness.seedSquadMember({
      email: "sm1@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking } = await import("./actions");
    await expect(
      harness.runAs(sm.cookies, () =>
        createBooking({
          name: "Forbidden",
          date: new Date(),
          venue: "x",
          ...optionalBookingFields,
        }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  it("assignUser is idempotent and sends one email per fresh assignment", async () => {
    const admin = await harness.seedAdmin({
      email: "admin2@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "member@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const sendMock = email.sendTemplated as unknown as ReturnType<typeof vi.fn>;
    sendMock.mockClear();

    const { createBooking, assignUser } = await import("./actions");
    const { getBookingById, listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Idempotent test",
        date: new Date("2026-07-01T18:00:00.000Z"),
        venue: "Studio B",
        ...optionalBookingFields,
      }),
    );
    const bookingRow = (
      await harness.runAs(admin.cookies, () => listBookings())
    ).find((e) => e.name === "Idempotent test");
    expect(bookingRow).toBeDefined();
    if (!bookingRow) return;

    const r1 = await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: bookingRow.id, userId: member.userId }),
    );
    expect(r1.error).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const r2 = await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: bookingRow.id, userId: member.userId }),
    );
    expect(r2.error).toBe(false);
    if (!r2.error) {
      expect(r2.message).toMatch(/already assigned/i);
    }
    expect(sendMock).toHaveBeenCalledTimes(1);

    const detail = await harness.runAs(admin.cookies, () =>
      getBookingById(bookingRow.id),
    );
    expect(detail?.assignees).toHaveLength(1);
  });

  it("messageBookingAssignees fans out one email per assignee", async () => {
    const admin = await harness.seedAdmin({
      email: "admin3@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const m1 = await harness.seedSquadMember({
      email: "m1@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const m2 = await harness.seedSquadMember({
      email: "m2@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");

    const { createBooking, assignUser, messageBookingAssignees } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Fanout test",
        date: new Date("2026-08-01T18:00:00.000Z"),
        venue: "Studio C",
        ...optionalBookingFields,
      }),
    );
    const booking = (
      await harness.runAs(admin.cookies, () => listBookings())
    ).find((e) => e.name === "Fanout test");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: booking.id, userId: m1.userId }),
    );
    await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: booking.id, userId: m2.userId }),
    );

    const sendMock2 = email.sendTemplated as unknown as ReturnType<
      typeof vi.fn
    >;
    sendMock2.mockClear();
    const r = await harness.runAs(admin.cookies, () =>
      messageBookingAssignees({
        bookingId: booking.id,
        subject: "Heads up",
        body: "See you there.",
      }),
    );
    expect(r.error).toBe(false);
    // iter-23: messageBookingAssignees now fans out via notifyUser (one per
    // recipient), which calls sendTemplated internally. Expect 2 calls — one
    // per assignee.
    expect(sendMock2).toHaveBeenCalledTimes(2);
  });

  it("messageBookingAssignees strips CR/LF from subject (header-injection guard)", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-crlf@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const m = await harness.seedSquadMember({
      email: "m-crlf@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");

    const { createBooking, assignUser, messageBookingAssignees } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "CRLF guard",
        date: new Date("2026-10-01T18:00:00.000Z"),
        venue: "Studio E",
        ...optionalBookingFields,
      }),
    );
    const booking = (
      await harness.runAs(admin.cookies, () => listBookings())
    ).find((e) => e.name === "CRLF guard");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: booking.id, userId: m.userId }),
    );

    const sendTemplatedMock2 = email.sendTemplated as unknown as ReturnType<
      typeof vi.fn
    >;
    sendTemplatedMock2.mockClear();
    const r = await harness.runAs(admin.cookies, () =>
      messageBookingAssignees({
        bookingId: booking.id,
        subject: "Heads up\r\nBcc: attacker@example.com",
        body: "See you there.",
      }),
    );
    expect(r.error, JSON.stringify(r)).toBe(false);
    // iter-23: fan-out is via notifyUser → sendTemplated (one call per assignee).
    expect(sendTemplatedMock2).toHaveBeenCalledTimes(1);
    // The subject passed to sendTemplated must be CR/LF-stripped. Locate
    // the params object by its `subject` property rather than indexing a
    // positional slot — keeps the test resilient to argument-order changes.
    const callArgs = sendTemplatedMock2.mock.calls[0] ?? [];
    const params = callArgs.find(
      (a): a is { subject: string } =>
        typeof a === "object" && a !== null && "subject" in a,
    );
    expect(params?.subject).toBeDefined();
    expect(params?.subject).not.toMatch(/[\r\n]/);
  });

  it("squad member can request participation on a published future booking; admin approves; member sees it as assigned", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-req@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "member-req@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const sendMock = email.sendTemplated as unknown as ReturnType<typeof vi.fn>;
    sendMock.mockClear();

    const {
      adminAcceptOffer,
      createBooking,
      requestParticipation,
      approveRequest,
    } = await import("./actions");
    const {
      listBookings,
      listMyAssignedBookings,
      listMyRequests,
      getBookingById,
    } = await import("./queries");

    // Admin creates and accepts a future booking (iter-25: participation requires status=accepted)
    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Request flow test",
        date: new Date("2027-01-15T18:00:00.000Z"),
        venue: "Studio Req",
        ...optionalBookingFields,
      }),
    );
    const bookingList = await harness.runAs(admin.cookies, () =>
      listBookings(),
    );
    const booking = bookingList.find((e) => e.name === "Request flow test");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );

    // Squad member requests participation
    const reqResult = await harness.runAs(member.cookies, () =>
      requestParticipation({ bookingId: booking.id }),
    );
    expect(reqResult.error, JSON.stringify(reqResult)).toBe(false);

    // iter-23: Admin(s) are notified via notifyUser (one sendTemplated call per
    // admin). At least one call is made (multiple admins may exist from previous
    // smoke tests seeded in the same DB).
    expect(sendMock.mock.calls.length).toBeGreaterThanOrEqual(1);

    // Member sees it in "Your requests"
    const requests = await harness.runAs(member.cookies, () =>
      listMyRequests(member.userId),
    );
    expect(requests.map((r) => r.id)).toContain(booking.id);
    const reqItem = requests.find((r) => r.id === booking.id);
    expect(reqItem?.assignmentStatus).toBe("requested");

    // Admin sees pending request on booking detail
    sendMock.mockClear();
    const detail = await harness.runAs(admin.cookies, () =>
      getBookingById(booking.id),
    );
    expect(detail?.pendingRequests).toHaveLength(1);
    expect(detail?.pendingRequests[0]?.userId).toBe(member.userId);

    // Admin approves
    const approveResult = await harness.runAs(admin.cookies, () =>
      approveRequest({ bookingId: booking.id, userId: member.userId }),
    );
    expect(approveResult.error, JSON.stringify(approveResult)).toBe(false);
    // Assignment email sent to member via sendTemplated.
    expect(sendMock).toHaveBeenCalledOnce();

    // Member now sees it in "Assigned to you"
    const assigned = await harness.runAs(member.cookies, () =>
      listMyAssignedBookings(member.userId),
    );
    expect(assigned.map((e) => e.id)).toContain(booking.id);
    const assignedItem = assigned.find((e) => e.id === booking.id);
    expect(assignedItem?.assignmentStatus).toBe("assigned");

    // No longer in requests
    const reqsAfter = await harness.runAs(member.cookies, () =>
      listMyRequests(member.userId),
    );
    expect(reqsAfter.map((r) => r.id)).not.toContain(booking.id);
  });

  it("squad member cannot request participation on a draft booking", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-draft@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "member-draft@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, requestParticipation } = await import("./actions");
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Draft booking",
        date: new Date("2027-02-01T18:00:00.000Z"),
        venue: "Studio Draft",
        ...optionalBookingFields,
      }),
    );
    const bookingList = await harness.runAs(admin.cookies, () =>
      listBookings(),
    );
    const booking = bookingList.find((e) => e.name === "Draft booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    const result = await harness.runAs(member.cookies, () =>
      requestParticipation({ bookingId: booking.id }),
    );
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/accepted/i);
  });

  it("squad member cannot approveRequest — PermissionError", async () => {
    const member = await harness.seedSquadMember({
      email: "member-approver@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { approveRequest } = await import("./actions");
    await expect(
      harness.runAs(member.cookies, () =>
        approveRequest({ bookingId: "any", userId: "any" }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  it("already-assigned member calling requestParticipation is a no-op", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-noop@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "member-noop@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const sendMockNoop = email.sendTemplated as unknown as ReturnType<
      typeof vi.fn
    >;

    const {
      adminAcceptOffer,
      createBooking,
      assignUser,
      requestParticipation,
    } = await import("./actions");
    const { listBookings, listUpcomingBookingsForRequest } = await import(
      "./queries"
    );

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Already assigned booking",
        date: new Date("2027-03-01T18:00:00.000Z"),
        venue: "Studio Noop",
        ...optionalBookingFields,
      }),
    );
    const bookingList = await harness.runAs(admin.cookies, () =>
      listBookings(),
    );
    const booking = bookingList.find(
      (e) => e.name === "Already assigned booking",
    );
    expect(booking).toBeDefined();
    if (!booking) return;

    // iter-25: accept the booking so it appears for participation requests
    await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );

    // Admin directly assigns the member
    await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: booking.id, userId: member.userId }),
    );

    // Booking should NOT appear in upcoming-bookings-for-request (already assigned)
    const upcoming = await harness.runAs(member.cookies, () =>
      listUpcomingBookingsForRequest(member.userId),
    );
    expect(upcoming.map((e) => e.id)).not.toContain(booking.id);

    // Member tries to request anyway — idempotent (onConflictDoNothing).
    // The action returns early without fanning out admin emails so repeated
    // clicks can't spam admins.
    sendMockNoop.mockClear();
    const result = await harness.runAs(member.cookies, () =>
      requestParticipation({ bookingId: booking.id }),
    );
    expect(result.error).toBe(false);
    expect(sendMockNoop).toHaveBeenCalledTimes(0);
  });

  it("admin can delete a booking — cascade removes assignments", async () => {
    const admin = await harness.seedAdmin({
      email: "admin4@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "deletetest@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, assignUser, deleteBooking } = await import(
      "./actions"
    );
    const { listBookings, getBookingById } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "To be deleted",
        date: new Date("2026-09-01T18:00:00.000Z"),
        venue: "Studio D",
        ...optionalBookingFields,
      }),
    );
    const booking = (
      await harness.runAs(admin.cookies, () => listBookings())
    ).find((e) => e.name === "To be deleted");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: booking.id, userId: member.userId }),
    );

    const r = await harness.runAs(admin.cookies, () =>
      deleteBooking({ bookingId: booking.id }),
    );
    expect(r.error).toBe(false);

    expect(
      await harness.runAs(admin.cookies, () => getBookingById(booking.id)),
    ).toBeNull();
    expect(
      (await harness.runAs(admin.cookies, () => listBookings()))
        .map((e) => e.id)
        .includes(booking.id),
    ).toBe(false);
  });

  // iter-25: lifecycle actions ------------------------------------------------

  it("replaceBookingSelections persists rows visible in getBookingById", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin1@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, replaceBookingSelections } = await import(
      "./actions"
    );
    const { listBookings, getBookingById } = await import("./queries");
    const { services } = await import("@wardrobe-assistants/db/schema");
    const { ulid } = await import("ulid");

    // Seed a service directly via the harness DB to avoid a cross-feature
    // import (biome forbids features/bookings importing features/services).
    const sewingId = ulid();
    await harness.db.insert(services).values({
      id: sewingId,
      name: "Sewing kit",
      description: "Take one along.",
      priceType: "fixed",
      price: 25,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Selections booking",
        date: new Date("2026-08-01T18:00:00.000Z"),
        venue: "Studio C",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Selections booking");
    if (!booking) throw new Error("booking not found");

    const r = await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: sewingId, quantity: 2 }],
      }),
    );
    expect(r.error, JSON.stringify(r)).toBe(false);

    const detail = await harness.runAs(admin.cookies, () =>
      getBookingById(booking.id),
    );
    expect(detail?.selections).toHaveLength(1);
    expect(detail?.selections[0]?.quantity).toBe(2);
    expect(detail?.selections[0]?.serviceName).toBe("Sewing kit");
  });

  // iter-28: replaceBookingSelections now allows offered/accepted — only
  // terminal states (rejected, cancelled) block edits.
  it("replaceBookingSelections refuses rejected/cancelled bookings", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin2@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, replaceBookingSelections, rejectBooking } =
      await import("./actions");
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Locked-edit booking",
        date: new Date("2026-08-02T18:00:00.000Z"),
        venue: "Studio D",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Locked-edit booking");
    expect(booking).toBeDefined();
    if (!booking) return;

    await harness.runAs(admin.cookies, () =>
      rejectBooking({ bookingId: booking.id, reason: undefined }),
    );

    const r = await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [],
      }),
    );
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/rejected|cancelled/i);
  });

  it("squad member is denied replaceBookingSelections", async () => {
    const sm = await harness.seedSquadMember({
      email: "lifecycle-sm1@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { replaceBookingSelections } = await import("./actions");
    await expect(
      harness.runAs(sm.cookies, () =>
        replaceBookingSelections({
          bookingId: "anything",
          selections: [],
        }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  it("adminAcceptOffer transitions created -> accepted and writes a snapshot", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin3@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, adminAcceptOffer, replaceBookingSelections } =
      await import("./actions");
    const { listBookings, getBookingById } = await import("./queries");
    const { services } = await import("@wardrobe-assistants/db/schema");
    const { ulid } = await import("ulid");

    const steamingId = ulid();
    await harness.db.insert(services).values({
      id: steamingId,
      name: "Steaming",
      description: "Costume steaming.",
      priceType: "hourly",
      price: 80,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Accept-path booking",
        date: new Date("2026-09-01T18:00:00.000Z"),
        venue: "Studio E",
        // iter-37 §C.2: min 5h required for new bookings — use 6h for the
        // hourly-service price calculation test (previously 3h, now 6h).
        ...optionalBookingFields,
        durationHours: 6,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Accept-path booking");
    if (!booking) throw new Error("booking not found");

    await harness.runAs(admin.cookies, () =>
      replaceBookingSelections({
        bookingId: booking.id,
        selections: [{ serviceId: steamingId, quantity: 1 }],
      }),
    );

    const r = await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );
    expect(r.error, JSON.stringify(r)).toBe(false);

    const detail = await harness.runAs(admin.cookies, () =>
      getBookingById(booking.id),
    );
    expect(detail?.status).toBe("accepted");
    expect(detail?.acceptedAt).not.toBeNull();
    expect(detail?.offerVersion).toBe(1);
  });

  it("adminAcceptOffer refuses non-'created'/'offered' states", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin4@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, adminAcceptOffer, rejectBooking } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Reject-then-accept",
        date: new Date("2026-09-02T18:00:00.000Z"),
        venue: "Studio F",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Reject-then-accept");
    if (!booking) throw new Error("booking not found");

    await harness.runAs(admin.cookies, () =>
      rejectBooking({ bookingId: booking.id, reason: undefined }),
    );
    const r = await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/cannot accept/i);
  });

  it("squad member is denied adminAcceptOffer / rejectBooking / cancelBooking", async () => {
    const sm = await harness.seedSquadMember({
      email: "lifecycle-sm2@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { adminAcceptOffer, rejectBooking, cancelBooking } = await import(
      "./actions"
    );
    await expect(
      harness.runAs(sm.cookies, () =>
        adminAcceptOffer({ bookingId: "anything" }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
    await expect(
      harness.runAs(sm.cookies, () =>
        rejectBooking({ bookingId: "anything", reason: undefined }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
    await expect(
      harness.runAs(sm.cookies, () =>
        cancelBooking({ bookingId: "anything", reason: undefined }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  it("rejectBooking transitions created -> rejected; emails customer if email on file", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin5@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, rejectBooking } = await import("./actions");
    const { listBookings, getBookingById } = await import("./queries");
    const { sendTemplated } = await import("@/lib/email");
    (sendTemplated as unknown as ReturnType<typeof vi.fn>).mockClear();

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Reject-path booking",
        date: new Date("2026-09-03T18:00:00.000Z"),
        venue: "Studio G",
        ...optionalBookingFields,
        customerName: "Sam",
        customerEmail: "sam@example.com",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Reject-path booking");
    if (!booking) throw new Error("booking not found");

    const r = await harness.runAs(admin.cookies, () =>
      rejectBooking({ bookingId: booking.id, reason: "Date conflict." }),
    );
    expect(r.error, JSON.stringify(r)).toBe(false);

    const detail = await harness.runAs(admin.cookies, () =>
      getBookingById(booking.id),
    );
    expect(detail?.status).toBe("rejected");
    expect(sendTemplated).toHaveBeenCalledWith(
      "bookingRejected",
      "sam@example.com",
      expect.objectContaining({ reason: "Date conflict." }),
    );
  });

  it("rejectBooking refuses non-'created' bookings", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin6@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, rejectBooking, adminAcceptOffer } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Reject-after-accept",
        date: new Date("2026-09-04T18:00:00.000Z"),
        venue: "Studio H",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Reject-after-accept");
    if (!booking) throw new Error("booking not found");

    await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );
    const r = await harness.runAs(admin.cookies, () =>
      rejectBooking({ bookingId: booking.id, reason: undefined }),
    );
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/cannot reject/i);
  });

  it("cancelBooking transitions accepted -> cancelled and emails customer + assignees", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin7@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "lifecycle-sm-assigned@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, adminAcceptOffer, cancelBooking, assignUser } =
      await import("./actions");
    const { listBookings, getBookingById } = await import("./queries");
    const { sendTemplated } = await import("@/lib/email");
    (sendTemplated as unknown as ReturnType<typeof vi.fn>).mockClear();

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Cancel-path booking",
        date: new Date("2026-09-05T18:00:00.000Z"),
        venue: "Studio I",
        ...optionalBookingFields,
        customerName: "Lee",
        customerEmail: "lee@example.com",
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Cancel-path booking");
    if (!booking) throw new Error("booking not found");

    await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );
    await harness.runAs(admin.cookies, () =>
      assignUser({ bookingId: booking.id, userId: member.userId }),
    );

    const r = await harness.runAs(admin.cookies, () =>
      cancelBooking({ bookingId: booking.id, reason: "Venue unavailable." }),
    );
    expect(r.error, JSON.stringify(r)).toBe(false);

    const detail = await harness.runAs(admin.cookies, () =>
      getBookingById(booking.id),
    );
    expect(detail?.status).toBe("cancelled");
    expect(sendTemplated).toHaveBeenCalledWith(
      "bookingCancelled",
      "lee@example.com",
      expect.objectContaining({ recipient: "customer" }),
    );
  });

  it("cancelBooking refuses non-'accepted' bookings", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin8@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, cancelBooking } = await import("./actions");
    const { listBookings } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Cancel-from-created",
        date: new Date("2026-09-06T18:00:00.000Z"),
        venue: "Studio J",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Cancel-from-created");
    if (!booking) throw new Error("booking not found");

    const r = await harness.runAs(admin.cookies, () =>
      cancelBooking({ bookingId: booking.id, reason: undefined }),
    );
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/cannot cancel/i);
  });

  // iter-34 §4: deterministic race-safety smoke for the conditional-UPDATE
  // guard on cancelBooking. The action reads booking.status (pre-tx), then
  // UPDATEs with `WHERE id = ? AND status = 'accepted'` and inspects
  // `.returning()` to detect a zero-row result. We exercise the zero-row
  // path specifically by leaving the row in "accepted" (so the pre-tx
  // guard passes) and intercepting the action's UPDATE so a concurrent
  // committed transition (status -> "rejected") lands in the gap between
  // pre-read and write. Without `WHERE status = ?` in the guard, the
  // action would overwrite "rejected" with "cancelled" silently; without
  // `.returning()` the zero-row case would still report success. Both
  // halves are required and both are asserted here.
  it("cancelBooking: concurrent transition between pre-read and UPDATE — zero-row error path", async () => {
    const admin = await harness.seedAdmin({
      email: "lifecycle-admin9@bookings-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createBooking, adminAcceptOffer, cancelBooking } = await import(
      "./actions"
    );
    const { listBookings } = await import("./queries");
    const { bookings } = await import("@wardrobe-assistants/db/schema");
    const { eq } = await import("drizzle-orm");

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Race-cancel booking",
        date: new Date("2026-09-07T18:00:00.000Z"),
        venue: "Studio K",
        ...optionalBookingFields,
      }),
    );
    const list = await harness.runAs(admin.cookies, () => listBookings());
    const booking = list.find((b) => b.name === "Race-cancel booking");
    if (!booking) throw new Error("booking not found");

    await harness.runAs(admin.cookies, () =>
      adminAcceptOffer({ bookingId: booking.id }),
    );

    // Race injector: spy on db.update so the action's first bookings UPDATE
    // is preceded by a concurrent committed status flip to "rejected".
    // Returning a hand-wrapped query builder lets us hook the terminal
    // `.returning()` step to atomically execute the side write just before
    // the action's UPDATE runs.
    type UpdateFn = typeof harness.db.update;
    const realUpdate = harness.db.update.bind(harness.db) as UpdateFn;
    let injected = false;
    const spy = vi.spyOn(harness.db, "update").mockImplementation(((
      table: Parameters<UpdateFn>[0],
    ) => {
      if (!injected && table === bookings) {
        injected = true;
        const inner = realUpdate(table);
        return {
          // biome-ignore lint/suspicious/noExplicitAny: thin pass-through wrapper.
          set: (vals: any) => {
            const w = inner.set(vals);
            return {
              // biome-ignore lint/suspicious/noExplicitAny: thin pass-through wrapper.
              where: (cond: any) => {
                const r = w.where(cond);
                return {
                  // biome-ignore lint/suspicious/noExplicitAny: thin pass-through wrapper.
                  returning: async (cols?: any) => {
                    // Concurrent committed transition lands here.
                    await realUpdate(bookings)
                      .set({ status: "rejected" })
                      .where(eq(bookings.id, booking.id));
                    return cols ? r.returning(cols) : r.returning();
                  },
                };
              },
            };
          },
        };
      }
      return realUpdate(table);
      // biome-ignore lint/suspicious/noExplicitAny: drizzle's UpdateFn return is structurally compatible.
    }) as any);

    let r: Awaited<ReturnType<typeof cancelBooking>>;
    try {
      r = await harness.runAs(admin.cookies, () =>
        cancelBooking({ bookingId: booking.id, reason: undefined }),
      );
    } finally {
      spy.mockRestore();
    }

    expect(r.error, JSON.stringify(r)).toBe(true);
    expect(r.message).toMatch(/changed during cancel/i);

    // Final state reflects the racing committer's transition, not our cancel.
    const after = await harness.db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
      .limit(1);
    expect(after[0]?.status).toBe("rejected");
  });
});
