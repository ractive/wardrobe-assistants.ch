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
        notes: undefined,
        status: "draft",
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
          notes: undefined,
          status: "draft",
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
        notes: undefined,
        status: "draft",
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
        notes: undefined,
        status: "published",
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
        notes: undefined,
        status: "published",
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

    const { createBooking, requestParticipation, approveRequest } =
      await import("./actions");
    const {
      listBookings,
      listMyAssignedBookings,
      listMyRequests,
      getBookingById,
    } = await import("./queries");

    // Admin creates a published future booking
    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Request flow test",
        date: new Date("2027-01-15T18:00:00.000Z"),
        venue: "Studio Req",
        notes: undefined,
        status: "published",
      }),
    );
    const bookingList = await harness.runAs(admin.cookies, () =>
      listBookings(),
    );
    const booking = bookingList.find((e) => e.name === "Request flow test");
    expect(booking).toBeDefined();
    if (!booking) return;

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
        notes: undefined,
        status: "draft",
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
    expect(result.message).toMatch(/published/i);
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

    const { createBooking, assignUser, requestParticipation } = await import(
      "./actions"
    );
    const { listBookings, listUpcomingBookingsForRequest } = await import(
      "./queries"
    );

    await harness.runAs(admin.cookies, () =>
      createBooking({
        name: "Already assigned booking",
        date: new Date("2027-03-01T18:00:00.000Z"),
        venue: "Studio Noop",
        notes: undefined,
        status: "published",
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
        notes: undefined,
        status: "draft",
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
});
