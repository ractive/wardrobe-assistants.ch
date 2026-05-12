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
// Stub auth so loading lib/permissions (via importOriginal) doesn't pull in
// lib/auth → lib/env and trip the env validator. The mock body is only needed
// because permissions.ts reads getCurrentUserRole at module init, but the
// withPermission override below short-circuits the real check.
vi.mock("@/lib/auth", () => ({
  auth: { api: {} },
  getCurrentUserRole: async () => null,
  roleForUserId: async () => null,
}));
vi.mock("@/lib/email");
// iter-23: actions now route through notifyUser instead of sendTemplated/
// sendTemplatedBatch directly. Mock notify at the boundary; the email mock
// is kept so lib/email's module-level code doesn't trip on missing env.
vi.mock("@/lib/notify", () => ({
  notifyUser: vi.fn(async () => {}),
}));
// Stub env so actions that reference env.betterAuthUrl (bookingUrl in emails)
// don't trip the env validator in a test environment without real env vars.
vi.mock("@/lib/env", () => ({
  env: {
    betterAuthUrl: "https://admin.example.com",
    emailFrom: "Test <test@example.com>",
    nodeEnv: "test",
    resendApiKey: undefined,
  },
}));

import { db } from "@/lib/db";
import { sendTemplated, sendTemplatedBatch } from "@/lib/email";
import { notifyUser } from "@/lib/notify";
import {
  approveRequest,
  assignUser,
  createBooking,
  deleteBooking,
  messageBookingAssignees,
  rejectRequest,
  requestParticipation,
  unassignUser,
  updateBooking,
} from "./actions";

interface SelectChain {
  result: unknown[];
}

// Drizzle's query builders are thenable: every chain link returns the same
// builder, and awaiting it executes the query. The mock mirrors that shape
// — a single `chain` object with `from/innerJoin/where/limit/orderBy` all
// returning `chain`, plus a `then` that resolves to the queued result.
function makeDbMock() {
  return {
    _selectQueue: [] as SelectChain[],
    _insertImpl: vi.fn<(values: unknown) => Promise<unknown>>(),
    _onConflictResult: [] as unknown[],
    _updateReturning: [] as unknown[],
    _deleteReturning: [] as unknown[],
    select() {
      const result = (this._selectQueue.shift() ?? { result: [] }).result;
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      chain.from = passthrough;
      chain.innerJoin = passthrough;
      chain.leftJoin = passthrough;
      chain.where = passthrough;
      chain.limit = passthrough;
      chain.orderBy = passthrough;
      // biome-ignore lint/suspicious/noThenProperty: deliberately thenable to mirror Drizzle's query builder.
      chain.then = (
        onF: (v: unknown[]) => unknown,
        onR?: (e: unknown) => unknown,
      ) => Promise.resolve(result).then(onF, onR);
      return chain;
    },
    insert() {
      const self = this;
      return {
        values(v: unknown) {
          const inserted = self._insertImpl(v);
          return {
            onConflictDoNothing: () => ({
              returning: async () => self._onConflictResult,
            }),
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
    delete() {
      return {
        where: () => ({
          returning: async () => this._deleteReturning,
        }),
      };
    },
    pushSelect(result: unknown[]) {
      this._selectQueue.push({ result });
    },
  };
}

const dbMock = db as unknown as ReturnType<typeof makeDbMock>;
// iter-23: actions now call notifyUser (not sendTemplated/sendTemplatedBatch).
// Keep sendTemplated/sendTemplatedBatch variables so we don't need to remove
// the import (it's used by the email module-level load); but assert on
// notifyUserMock for the triggers that changed.
const _sendTemplatedMock = sendTemplated as unknown as ReturnType<typeof vi.fn>;
const _sendTemplatedBatchMock = sendTemplatedBatch as unknown as ReturnType<
  typeof vi.fn
>;
const notifyUserMock = notifyUser as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  dbMock._selectQueue = [];
  dbMock._insertImpl = vi.fn(async () => undefined);
  dbMock._onConflictResult = [];
  dbMock._updateReturning = [];
  dbMock._deleteReturning = [];
  _sendTemplatedMock.mockReset();
  _sendTemplatedMock.mockResolvedValue(undefined);
  _sendTemplatedBatchMock.mockReset();
  _sendTemplatedBatchMock.mockResolvedValue({ sent: 0, failed: 0 });
  notifyUserMock.mockReset();
  notifyUserMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createBooking", () => {
  // iter-37 §C.3: startTime, durationHours, city are now required for
  // new bookings at the app layer.
  const valid = {
    name: "Spring",
    date: new Date("2026-06-01"),
    venue: "Studio A",
    notes: undefined,
    customerName: undefined,
    customerEmail: undefined,
    customerPhone: undefined,
    startTime: "18:00",
    durationHours: 8,
    city: "Zurich",
    comment: undefined,
  };

  it("rejects invalid input", async () => {
    const r = await createBooking({ ...valid, name: "" });
    expect(r.error).toBe(true);
  });

  it("inserts and returns success", async () => {
    const r = await createBooking(valid);
    expect(r).toEqual({ error: false, message: "Booking created." });
    // 2 inserts: bookings row + audit_log row (iter-16f).
    expect(dbMock._insertImpl).toHaveBeenCalledTimes(2);
  });
});

const updateBookingBase = {
  name: "x",
  date: new Date(),
  venue: "v",
  notes: undefined,
  customerName: undefined,
  customerEmail: undefined,
  customerPhone: undefined,
  startTime: undefined,
  durationHours: undefined,
  city: undefined,
  comment: undefined,
} as const;

describe("updateBooking", () => {
  it("returns 'not found' when 0 rows affected", async () => {
    dbMock.pushSelect([{ status: "created" }]); // status precondition
    dbMock._updateReturning = [];
    const r = await updateBooking({
      bookingId: "missing",
      ...updateBookingBase,
    });
    expect(r).toEqual({ error: true, message: "Booking not found." });
  });

  it("succeeds when a row is updated", async () => {
    dbMock.pushSelect([{ status: "created" }]); // status precondition
    dbMock._updateReturning = [{ id: "b1" }];
    const r = await updateBooking({
      bookingId: "b1",
      ...updateBookingBase,
    });
    expect(r).toEqual({ error: false, message: "Booking updated." });
  });

  it("refuses to edit a terminal booking", async () => {
    dbMock.pushSelect([{ status: "cancelled" }]);
    const r = await updateBooking({
      bookingId: "b1",
      ...updateBookingBase,
    });
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/closed/i);
  });
});

describe("deleteBooking", () => {
  it("returns 'not found' when 0 rows affected", async () => {
    dbMock._deleteReturning = [];
    const r = await deleteBooking({ bookingId: "missing" });
    expect(r).toEqual({ error: true, message: "Booking not found." });
  });

  it("succeeds when a row is deleted", async () => {
    dbMock._deleteReturning = [{ id: "b1" }];
    const r = await deleteBooking({ bookingId: "b1" });
    expect(r).toEqual({ error: false, message: "Booking deleted." });
  });
});

describe("assignUser", () => {
  const baseBooking = {
    id: "b1",
    name: "Spring",
    date: new Date(),
    venue: "Studio",
    notes: null,
  };

  it("is idempotent: skips notification if assignment already existed", async () => {
    dbMock.pushSelect([baseBooking]);
    dbMock.pushSelect([{ email: "u@example.com" }]);
    dbMock.pushSelect([{ status: "assigned" }]); // existing assigned row
    const r = await assignUser({ bookingId: "b1", userId: "u1" });
    expect(r).toEqual({ error: false, message: "User was already assigned." });
    expect(notifyUserMock).not.toHaveBeenCalled();
  });

  it("notifies via notifyUser on a fresh assignment", async () => {
    dbMock.pushSelect([baseBooking]);
    dbMock.pushSelect([{ email: "u@example.com" }]);
    dbMock.pushSelect([]); // no existing row
    const r = await assignUser({ bookingId: "b1", userId: "u1" });
    expect(r.error).toBe(false);
    expect(notifyUserMock).toHaveBeenCalledOnce();
    expect(notifyUserMock).toHaveBeenCalledWith(
      "u1",
      "assignmentInvite",
      expect.objectContaining({ bookingName: "Spring" }),
    );
  });

  it("flips a `requested` row to `assigned` and notifies", async () => {
    dbMock.pushSelect([baseBooking]);
    dbMock.pushSelect([{ email: "u@example.com" }]);
    dbMock.pushSelect([{ status: "requested" }]);
    // iter-34 §4: conditional UPDATE on existing assignment now `.returning()`s
    // the row; mock a one-row result so the action's race-detection path is
    // not falsely triggered.
    dbMock._updateReturning = [{ userId: "u1" }];
    const r = await assignUser({ bookingId: "b1", userId: "u1" });
    expect(r.error).toBe(false);
    expect(notifyUserMock).toHaveBeenCalledOnce();
  });

  it("returns a soft warning when notification fails", async () => {
    dbMock.pushSelect([baseBooking]);
    dbMock.pushSelect([{ email: "u@example.com" }]);
    dbMock.pushSelect([]); // no existing row
    notifyUserMock.mockRejectedValue(new Error("notify boom"));
    const r = await assignUser({ bookingId: "b1", userId: "u1" });
    expect(r).toEqual({
      error: false,
      message: "Assigned, but notification failed to send.",
    });
  });

  it("returns 'booking not found' when the booking is missing", async () => {
    dbMock.pushSelect([]);
    const r = await assignUser({ bookingId: "ghost", userId: "u1" });
    expect(r).toEqual({ error: true, message: "Booking not found." });
    expect(notifyUserMock).not.toHaveBeenCalled();
  });
});

describe("unassignUser", () => {
  it("returns 'not found' when 0 rows affected", async () => {
    dbMock._deleteReturning = [];
    const r = await unassignUser({ bookingId: "b1", userId: "u1" });
    expect(r).toEqual({ error: true, message: "Assignment not found." });
  });

  it("succeeds when a row is deleted", async () => {
    dbMock._deleteReturning = [{ userId: "u1" }];
    const r = await unassignUser({ bookingId: "b1", userId: "u1" });
    expect(r).toEqual({ error: false, message: "User unassigned." });
  });
});

describe("messageBookingAssignees", () => {
  it("returns 'no assignees' when the recipient list is empty", async () => {
    dbMock.pushSelect([{ id: "b1", name: "Spring" }]); // booking exists
    dbMock.pushSelect([]); // recipients
    const r = await messageBookingAssignees({
      bookingId: "b1",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r).toEqual({
      error: true,
      message: "No assignees on this booking.",
    });
  });

  it("fans out to every assignee via notifyUser", async () => {
    dbMock.pushSelect([{ id: "b1", name: "Spring" }]);
    dbMock.pushSelect([
      { userId: "u1", email: "a@example.com" },
      { userId: "u2", email: "b@example.com" },
    ]);
    const r = await messageBookingAssignees({
      bookingId: "b1",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r).toEqual({ error: false, message: "Sent to 2 assignees." });
    expect(notifyUserMock).toHaveBeenCalledTimes(2);
  });

  it("reports partial-success when some notifyUser calls reject", async () => {
    dbMock.pushSelect([{ id: "b1", name: "Spring" }]);
    dbMock.pushSelect([
      { userId: "u1", email: "ok@example.com" },
      { userId: "u2", email: "bad@example.com" },
    ]);
    // First call succeeds, second rejects — partial send.
    notifyUserMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("channel down"));
    const r = await messageBookingAssignees({
      bookingId: "b1",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r).toEqual({
      error: false,
      message: "Sent to 1 of 2 assignees.",
    });
  });

  it("reports a hard error when all notifyUser calls reject", async () => {
    dbMock.pushSelect([{ id: "b1", name: "Spring" }]);
    dbMock.pushSelect([
      { userId: "u1", email: "a@example.com" },
      { userId: "u2", email: "b@example.com" },
    ]);
    notifyUserMock.mockRejectedValue(new Error("all down"));
    const r = await messageBookingAssignees({
      bookingId: "b1",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r.error).toBe(true);
    if (r.error) {
      // iter-16f / C-SEC-08+10: generic message + correlation ID
      // (`ref ...`) tying the toast to an audit-log row.
      expect(r.message).toMatch(/Could not send to any assignee/);
      expect(r.message).toMatch(/ref [0-9A-Z]{20,}/);
    }
  });

  it("returns 'booking not found' when the booking id is bogus", async () => {
    dbMock.pushSelect([]);
    const r = await messageBookingAssignees({
      bookingId: "ghost",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r).toEqual({ error: true, message: "Booking not found." });
    expect(notifyUserMock).not.toHaveBeenCalled();
  });
});

describe("requestParticipation", () => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days from now
  const baseBooking = {
    id: "b1",
    name: "Spring Booking",
    status: "accepted",
    date: futureDate,
  };

  it("rejects invalid input (empty bookingId)", async () => {
    const r = await requestParticipation({ bookingId: "" });
    expect(r.error).toBe(true);
  });

  it("returns error when booking not found", async () => {
    dbMock.pushSelect([]); // booking not found
    const r = await requestParticipation({ bookingId: "ghost" });
    expect(r).toEqual({ error: true, message: "Booking not found." });
  });

  it("returns error when booking is not accepted", async () => {
    dbMock.pushSelect([{ ...baseBooking, status: "created" }]);
    const r = await requestParticipation({ bookingId: "b1" });
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/accepted/i);
  });

  it("returns error when booking is in the past", async () => {
    dbMock.pushSelect([{ ...baseBooking, date: new Date("2020-01-01") }]);
    const r = await requestParticipation({ bookingId: "b1" });
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/past/i);
  });

  it("succeeds on a valid accepted future booking and fans out to admins", async () => {
    dbMock.pushSelect([baseBooking]); // booking lookup
    dbMock._onConflictResult = [{ userId: "actor1" }]; // new request inserted
    dbMock.pushSelect([{ id: "admin1", email: "admin@example.com" }]);
    dbMock.pushSelect([
      {
        firstName: "Test",
        lastName: "User",
        nickname: null,
        email: "actor@example.com",
      },
    ]); // actor profile
    const r = await requestParticipation({ bookingId: "b1" });
    expect(r).toEqual({ error: false, message: "Participation request sent." });
    // iter-23: fan-out is via notifyUser (one per admin).
    expect(notifyUserMock).toHaveBeenCalledOnce();
    expect(notifyUserMock).toHaveBeenCalledWith(
      "admin1",
      "participationRequested",
      expect.objectContaining({ actorName: "Test User" }),
    );
  });

  it("is a no-op when the user already has a row (idempotent)", async () => {
    dbMock.pushSelect([baseBooking]);
    dbMock._onConflictResult = []; // insert no-op
    const r = await requestParticipation({ bookingId: "b1" });
    expect(r).toEqual({
      error: false,
      message: "Participation already recorded.",
    });
    expect(notifyUserMock).not.toHaveBeenCalled();
  });
});

describe("approveRequest", () => {
  it("rejects invalid input", async () => {
    const r = await approveRequest({ bookingId: "", userId: "u1" });
    expect(r.error).toBe(true);
  });

  it("returns error when no pending request found", async () => {
    dbMock._updateReturning = [];
    const r = await approveRequest({ bookingId: "b1", userId: "u1" });
    expect(r).toEqual({
      error: true,
      message: "No pending request found for this user on this booking.",
    });
  });

  it("succeeds and notifies when request is pending", async () => {
    dbMock._updateReturning = [{ userId: "u1" }];
    dbMock.pushSelect([
      {
        name: "Booking",
        date: new Date(),
        venue: "Studio",
        notes: null,
      },
    ]); // booking for notification
    dbMock.pushSelect([{ email: "member@example.com", name: "Alice" }]); // user
    const r = await approveRequest({ bookingId: "b1", userId: "u1" });
    expect(r.error).toBe(false);
    expect(notifyUserMock).toHaveBeenCalledOnce();
    expect(notifyUserMock).toHaveBeenCalledWith(
      "u1",
      "assignmentInvite",
      expect.objectContaining({ bookingName: "Booking" }),
    );
  });

  it("returns soft warning when notification fails", async () => {
    dbMock._updateReturning = [{ userId: "u1" }];
    dbMock.pushSelect([
      {
        name: "Booking",
        date: new Date(),
        venue: "Studio",
        notes: null,
      },
    ]);
    dbMock.pushSelect([{ email: "member@example.com", name: "Alice" }]);
    notifyUserMock.mockRejectedValue(new Error("notify down"));
    const r = await approveRequest({ bookingId: "b1", userId: "u1" });
    expect(r.error).toBe(false);
    expect(r.message).toMatch(/notification failed/i);
  });
});

describe("rejectRequest", () => {
  it("rejects invalid input", async () => {
    const r = await rejectRequest({ bookingId: "", userId: "u1" });
    expect(r.error).toBe(true);
  });

  it("returns error when no pending request found", async () => {
    dbMock._updateReturning = [];
    const r = await rejectRequest({ bookingId: "b1", userId: "u1" });
    expect(r).toEqual({
      error: true,
      message: "No pending request found for this user on this booking.",
    });
  });

  it("succeeds when request is pending", async () => {
    dbMock._updateReturning = [{ userId: "u1" }];
    const r = await rejectRequest({ bookingId: "b1", userId: "u1" });
    expect(r).toEqual({ error: false, message: "Request rejected." });
    expect(notifyUserMock).not.toHaveBeenCalled();
  });
});
