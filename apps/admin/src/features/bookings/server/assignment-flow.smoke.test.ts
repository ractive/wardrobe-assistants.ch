// @vitest-environment node
//
// Smoke tests for iter-29 squad-assignment confirmation flow:
// confirmAssignment / declineAssignment / withdrawAssignment + ICS download.
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

const optionalBookingFields = {
  notes: undefined,
  customerName: undefined,
  customerEmail: undefined,
  customerPhone: undefined,
  startTime: undefined,
  durationHours: undefined,
  venueName: undefined,
  venueCity: undefined,
  comment: undefined,
} as const;

async function setupAssignedBooking(opts: {
  admin: { cookies: Headers };
  smId: string;
  name: string;
}) {
  const { createBooking, assignUser, adminAcceptOffer } = await import(
    "./actions"
  );
  const { listBookings } = await import("./queries");
  await harness.runAs(opts.admin.cookies, () =>
    createBooking({
      name: opts.name,
      date: new Date("2027-06-15T18:00:00.000Z"),
      venue: "Studio Confirm",
      ...optionalBookingFields,
      startTime: "18:00",
      durationHours: 3,
    }),
  );
  const list = await harness.runAs(opts.admin.cookies, () => listBookings());
  const booking = list.find((b) => b.name === opts.name);
  if (!booking) throw new Error("booking not created");
  await harness.runAs(opts.admin.cookies, () =>
    adminAcceptOffer({ bookingId: booking.id }),
  );
  await harness.runAs(opts.admin.cookies, () =>
    assignUser({ bookingId: booking.id, userId: opts.smId }),
  );
  return booking.id;
}

describe("assignment flow — smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  it("confirmAssignment: happy path assigned → confirmed; idempotent on repeat", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin1@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm1@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const bookingId = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Confirm happy-path",
    });

    const { confirmAssignment } = await import("./assignment-actions");
    const { bookingAssignments, auditLog } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");

    const r1 = await harness.runAs(sm.cookies, () =>
      confirmAssignment({ bookingId }),
    );
    expect(r1.error, JSON.stringify(r1)).toBe(false);

    const after = await harness.db
      .select()
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, sm.userId),
        ),
      );
    expect(after[0]?.status).toBe("confirmed");
    expect(after[0]?.confirmedAt).not.toBeNull();

    // Idempotent on repeat.
    const r2 = await harness.runAs(sm.cookies, () =>
      confirmAssignment({ bookingId }),
    );
    expect(r2.error).toBe(false);

    const audits = await harness.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetType, "booking_assignment"),
          eq(auditLog.targetId, `${bookingId}:${sm.userId}`),
          eq(auditLog.action, "assignment.confirmed"),
        ),
      );
    // Only one audit row — the second call short-circuited as idempotent.
    expect(audits.length).toBe(1);
  });

  it("confirmAssignment: other user's session cannot confirm (no row → not-found)", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin2@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm2@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const other = await harness.seedSquadMember({
      email: "assign-other2@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const bookingId = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Confirm-wrong-user",
    });

    const { confirmAssignment } = await import("./assignment-actions");
    const result = await harness.runAs(other.cookies, () =>
      confirmAssignment({ bookingId }),
    );
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/not found/i);
  });

  it("confirmAssignment: re-confirm from withdrawn succeeds", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin3@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm3@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const bookingId = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Reconfirm-from-withdrawn",
    });

    const { confirmAssignment, withdrawAssignment } = await import(
      "./assignment-actions"
    );
    await harness.runAs(sm.cookies, () => confirmAssignment({ bookingId }));
    await harness.runAs(sm.cookies, () =>
      withdrawAssignment({ bookingId, reason: undefined }),
    );

    const { bookingAssignments } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");
    const w = await harness.db
      .select()
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, sm.userId),
        ),
      );
    expect(w[0]?.status).toBe("withdrawn");

    const r = await harness.runAs(sm.cookies, () =>
      confirmAssignment({ bookingId }),
    );
    expect(r.error, JSON.stringify(r)).toBe(false);

    const c = await harness.db
      .select()
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, sm.userId),
        ),
      );
    expect(c[0]?.status).toBe("confirmed");
  });

  it("declineAssignment: works from assigned and from confirmed", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin4@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm4@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { confirmAssignment, declineAssignment } = await import(
      "./assignment-actions"
    );
    const { bookingAssignments, auditLog } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");

    // From assigned.
    const id1 = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Decline-from-assigned",
    });
    const r1 = await harness.runAs(sm.cookies, () =>
      declineAssignment({ bookingId: id1 }),
    );
    expect(r1.error, JSON.stringify(r1)).toBe(false);
    const row1 = await harness.db
      .select()
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, id1),
          eq(bookingAssignments.userId, sm.userId),
        ),
      );
    expect(row1[0]?.status).toBe("rejected");

    // From confirmed.
    const id2 = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Decline-from-confirmed",
    });
    await harness.runAs(sm.cookies, () =>
      confirmAssignment({ bookingId: id2 }),
    );
    const r2 = await harness.runAs(sm.cookies, () =>
      declineAssignment({ bookingId: id2 }),
    );
    expect(r2.error, JSON.stringify(r2)).toBe(false);
    const row2 = await harness.db
      .select()
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, id2),
          eq(bookingAssignments.userId, sm.userId),
        ),
      );
    expect(row2[0]?.status).toBe("rejected");

    // Audit captures fromStatus distinctly.
    const audits = await harness.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetType, "booking_assignment"),
          eq(auditLog.action, "assignment.declined"),
        ),
      );
    const meta = audits
      .map((a) => JSON.parse(a.metadata ?? "{}") as Record<string, unknown>)
      .map((m) => m.fromStatus as string);
    expect(meta).toContain("assigned");
    expect(meta).toContain("confirmed");
  });

  it("withdrawAssignment: succeeds from confirmed; rejected from non-confirmed", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin5@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm5@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { confirmAssignment, withdrawAssignment } = await import(
      "./assignment-actions"
    );
    const { bookingAssignments, auditLog } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");

    const id1 = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Withdraw-non-confirmed",
    });
    // Without confirming first, withdraw should be rejected.
    const r0 = await harness.runAs(sm.cookies, () =>
      withdrawAssignment({ bookingId: id1, reason: undefined }),
    );
    expect(r0.error).toBe(true);

    // Confirm then withdraw with a reason.
    await harness.runAs(sm.cookies, () =>
      confirmAssignment({ bookingId: id1 }),
    );
    const r1 = await harness.runAs(sm.cookies, () =>
      withdrawAssignment({ bookingId: id1, reason: "Schedule conflict" }),
    );
    expect(r1.error, JSON.stringify(r1)).toBe(false);

    const row = await harness.db
      .select()
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, id1),
          eq(bookingAssignments.userId, sm.userId),
        ),
      );
    expect(row[0]?.status).toBe("withdrawn");
    expect(row[0]?.withdrawnAt).not.toBeNull();

    const audits = await harness.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetType, "booking_assignment"),
          eq(auditLog.targetId, `${id1}:${sm.userId}`),
          eq(auditLog.action, "assignment.withdrawn"),
        ),
      );
    expect(audits.length).toBe(1);
    const meta = JSON.parse(audits[0]?.metadata ?? "{}") as Record<
      string,
      unknown
    >;
    expect(meta.reason).toBe("Schedule conflict");
  });

  it("withdrawAssignment: reason > 500 chars rejected by zod validation", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin6@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm6@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { confirmAssignment, withdrawAssignment } = await import(
      "./assignment-actions"
    );
    const id = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Withdraw-long-reason",
    });
    await harness.runAs(sm.cookies, () => confirmAssignment({ bookingId: id }));

    const r = await harness.runAs(sm.cookies, () =>
      withdrawAssignment({ bookingId: id, reason: "x".repeat(501) }),
    );
    expect(r.error).toBe(true);
  });

  it("confirmAssignment: notifyAdmins called with assignmentConfirmed", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin7@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm7@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { confirmAssignment } = await import("./assignment-actions");
    const { sendTemplated } = await import("@/lib/email");
    const sendMock = sendTemplated as unknown as ReturnType<typeof vi.fn>;

    const id = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Notify-confirm",
    });
    sendMock.mockClear();
    await harness.runAs(sm.cookies, () => confirmAssignment({ bookingId: id }));

    const adminConfirmCall = sendMock.mock.calls.find(
      (args: unknown[]) => args[0] === "assignmentConfirmed",
    );
    expect(adminConfirmCall).toBeDefined();
  });

  it("withdrawAssignment: notifyAdmins called with assignmentWithdrawn carrying the reason", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin8@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm8@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { confirmAssignment, withdrawAssignment } = await import(
      "./assignment-actions"
    );
    const { sendTemplated } = await import("@/lib/email");
    const sendMock = sendTemplated as unknown as ReturnType<typeof vi.fn>;

    const id = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Notify-withdraw",
    });
    await harness.runAs(sm.cookies, () => confirmAssignment({ bookingId: id }));
    sendMock.mockClear();
    await harness.runAs(sm.cookies, () =>
      withdrawAssignment({ bookingId: id, reason: "Got sick" }),
    );
    const call = sendMock.mock.calls.find(
      (args: unknown[]) => args[0] === "assignmentWithdrawn",
    );
    expect(call).toBeDefined();
    expect(call?.[2]).toMatchObject({ reason: "Got sick" });
  });

  it("ICS route returns 200 + text/calendar only when status=confirmed; otherwise 404", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin9@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm9@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const id = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "ICS-route",
    });

    const { GET } = await import(
      "../../../app/(dashboard)/my-bookings/[bookingId]/ics/route"
    );

    // Pre-confirm — should 404.
    const res404 = await harness.runAs(sm.cookies, () =>
      GET(new Request("http://test/x"), {
        params: Promise.resolve({ bookingId: id }),
      }),
    );
    expect(res404.status).toBe(404);

    const { confirmAssignment } = await import("./assignment-actions");
    await harness.runAs(sm.cookies, () => confirmAssignment({ bookingId: id }));

    const res = await harness.runAs(sm.cookies, () =>
      GET(new Request("http://test/x"), {
        params: Promise.resolve({ bookingId: id }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/calendar/i);
    const body = await res.text();
    expect(body).toMatch(/BEGIN:VCALENDAR/);
    expect(body).toMatch(/BEGIN:VEVENT/);
    expect(body).toMatch(/UID:booking-/);
    expect(body).toMatch(/DTSTART;TZID=Europe\/Zurich:/);
    expect(body).toMatch(/DTEND;TZID=Europe\/Zurich:/);
    expect(body).toMatch(/SUMMARY:/);
    // CRLF line endings throughout.
    expect(body.includes("\r\n")).toBe(true);
  });

  it("Edge: assignment row deleted between page render and confirm → friendly error", async () => {
    const admin = await harness.seedAdmin({
      email: "assign-admin10@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const sm = await harness.seedSquadMember({
      email: "assign-sm10@assign-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const id = await setupAssignedBooking({
      admin,
      smId: sm.userId,
      name: "Race-deleted",
    });

    const { bookingAssignments } = await import(
      "@wardrobe-assistants/db/schema"
    );
    const { and, eq } = await import("drizzle-orm");
    await harness.db
      .delete(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, id),
          eq(bookingAssignments.userId, sm.userId),
        ),
      );

    const { confirmAssignment } = await import("./assignment-actions");
    const r = await harness.runAs(sm.cookies, () =>
      confirmAssignment({ bookingId: id }),
    );
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/not found/i);
  });
});
