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

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  approveRequest,
  assignUser,
  createEvent,
  deleteEvent,
  messageEventAssignees,
  rejectRequest,
  requestParticipation,
  unassignUser,
  updateEvent,
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
const sendEmailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  dbMock._selectQueue = [];
  dbMock._insertImpl = vi.fn(async () => undefined);
  dbMock._onConflictResult = [];
  dbMock._updateReturning = [];
  dbMock._deleteReturning = [];
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createEvent", () => {
  const valid = {
    name: "Spring",
    date: new Date("2026-06-01"),
    venue: "Studio A",
    notes: undefined,
    status: "draft" as const,
  };

  it("rejects invalid input", async () => {
    const r = await createEvent({ ...valid, name: "" });
    expect(r.error).toBe(true);
  });

  it("inserts and returns success", async () => {
    const r = await createEvent(valid);
    expect(r).toEqual({ error: false, message: "Event created." });
    // 2 inserts: events row + audit_log row (iter-16f).
    expect(dbMock._insertImpl).toHaveBeenCalledTimes(2);
  });
});

describe("updateEvent", () => {
  it("returns 'not found' when 0 rows affected", async () => {
    dbMock._updateReturning = [];
    const r = await updateEvent({
      eventId: "missing",
      name: "x",
      date: new Date(),
      venue: "v",
      notes: undefined,
      status: "draft",
    });
    expect(r).toEqual({ error: true, message: "Event not found." });
  });

  it("succeeds when a row is updated", async () => {
    dbMock._updateReturning = [{ id: "e1" }];
    const r = await updateEvent({
      eventId: "e1",
      name: "x",
      date: new Date(),
      venue: "v",
      notes: undefined,
      status: "draft",
    });
    expect(r).toEqual({ error: false, message: "Event updated." });
  });
});

describe("deleteEvent", () => {
  it("returns 'not found' when 0 rows affected", async () => {
    dbMock._deleteReturning = [];
    const r = await deleteEvent({ eventId: "missing" });
    expect(r).toEqual({ error: true, message: "Event not found." });
  });

  it("succeeds when a row is deleted", async () => {
    dbMock._deleteReturning = [{ id: "e1" }];
    const r = await deleteEvent({ eventId: "e1" });
    expect(r).toEqual({ error: false, message: "Event deleted." });
  });
});

describe("assignUser", () => {
  const baseEvent = {
    id: "e1",
    name: "Spring",
    date: new Date(),
    venue: "Studio",
    notes: null,
  };

  it("is idempotent: skips email if assignment already existed", async () => {
    dbMock.pushSelect([baseEvent]);
    dbMock.pushSelect([{ email: "u@example.com" }]);
    dbMock.pushSelect([{ status: "assigned" }]); // existing assigned row
    const r = await assignUser({ eventId: "e1", userId: "u1" });
    expect(r).toEqual({ error: false, message: "User was already assigned." });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends a notification email on a fresh assignment", async () => {
    dbMock.pushSelect([baseEvent]);
    dbMock.pushSelect([{ email: "u@example.com" }]);
    dbMock.pushSelect([]); // no existing row
    const r = await assignUser({ eventId: "e1", userId: "u1" });
    expect(r.error).toBe(false);
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it("flips a `requested` row to `assigned` and notifies", async () => {
    dbMock.pushSelect([baseEvent]);
    dbMock.pushSelect([{ email: "u@example.com" }]);
    dbMock.pushSelect([{ status: "requested" }]);
    const r = await assignUser({ eventId: "e1", userId: "u1" });
    expect(r.error).toBe(false);
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it("returns a soft warning when the email fails", async () => {
    dbMock.pushSelect([baseEvent]);
    dbMock.pushSelect([{ email: "u@example.com" }]);
    dbMock.pushSelect([]); // no existing row
    sendEmailMock.mockRejectedValue(new Error("smtp boom"));
    const r = await assignUser({ eventId: "e1", userId: "u1" });
    expect(r).toEqual({
      error: false,
      message: "Assigned, but notification email failed to send.",
    });
  });

  it("returns 'event not found' when the event is missing", async () => {
    dbMock.pushSelect([]);
    const r = await assignUser({ eventId: "ghost", userId: "u1" });
    expect(r).toEqual({ error: true, message: "Event not found." });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("unassignUser", () => {
  it("returns 'not found' when 0 rows affected", async () => {
    dbMock._deleteReturning = [];
    const r = await unassignUser({ eventId: "e1", userId: "u1" });
    expect(r).toEqual({ error: true, message: "Assignment not found." });
  });

  it("succeeds when a row is deleted", async () => {
    dbMock._deleteReturning = [{ userId: "u1" }];
    const r = await unassignUser({ eventId: "e1", userId: "u1" });
    expect(r).toEqual({ error: false, message: "User unassigned." });
  });
});

describe("messageEventAssignees", () => {
  it("returns 'no assignees' when the recipient list is empty", async () => {
    dbMock.pushSelect([{ id: "e1" }]); // event exists
    dbMock.pushSelect([]); // recipients
    const r = await messageEventAssignees({
      eventId: "e1",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r).toEqual({ error: true, message: "No assignees on this event." });
  });

  it("fans out to every assignee", async () => {
    dbMock.pushSelect([{ id: "e1" }]);
    dbMock.pushSelect([{ email: "a@example.com" }, { email: "b@example.com" }]);
    const r = await messageEventAssignees({
      eventId: "e1",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r).toEqual({ error: false, message: "Sent to 2 assignees." });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("reports partial-success counts", async () => {
    dbMock.pushSelect([{ id: "e1" }]);
    dbMock.pushSelect([
      { email: "ok@example.com" },
      { email: "bad@example.com" },
    ]);
    sendEmailMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("nope"));
    const r = await messageEventAssignees({
      eventId: "e1",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r).toEqual({
      error: false,
      message: "Sent to 1 of 2 assignees.",
    });
  });

  it("reports a hard error when all sends fail", async () => {
    dbMock.pushSelect([{ id: "e1" }]);
    dbMock.pushSelect([{ email: "a@example.com" }, { email: "b@example.com" }]);
    sendEmailMock.mockRejectedValue(new Error("smtp dead"));
    const r = await messageEventAssignees({
      eventId: "e1",
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

  it("returns 'event not found' when the event id is bogus", async () => {
    dbMock.pushSelect([]);
    const r = await messageEventAssignees({
      eventId: "ghost",
      subject: "Hi",
      body: "Hello.",
    });
    expect(r).toEqual({ error: true, message: "Event not found." });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("requestParticipation", () => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days from now
  const baseEvent = {
    id: "e1",
    name: "Spring Event",
    status: "published",
    date: futureDate,
  };

  it("rejects invalid input (empty eventId)", async () => {
    const r = await requestParticipation({ eventId: "" });
    expect(r.error).toBe(true);
  });

  it("returns error when event not found", async () => {
    dbMock.pushSelect([]); // event not found
    const r = await requestParticipation({ eventId: "ghost" });
    expect(r).toEqual({ error: true, message: "Event not found." });
  });

  it("returns error when event is not published", async () => {
    dbMock.pushSelect([{ ...baseEvent, status: "draft" }]);
    const r = await requestParticipation({ eventId: "e1" });
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/published/i);
  });

  it("returns error when event is in the past", async () => {
    dbMock.pushSelect([{ ...baseEvent, date: new Date("2020-01-01") }]);
    const r = await requestParticipation({ eventId: "e1" });
    expect(r.error).toBe(true);
    expect(r.message).toMatch(/past/i);
  });

  it("succeeds on a valid published future event and fans out to admins", async () => {
    dbMock.pushSelect([baseEvent]); // event lookup
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
    const r = await requestParticipation({ eventId: "e1" });
    expect(r).toEqual({ error: false, message: "Participation request sent." });
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it("is a no-op when the user already has a row (idempotent)", async () => {
    dbMock.pushSelect([baseEvent]);
    dbMock._onConflictResult = []; // insert no-op
    const r = await requestParticipation({ eventId: "e1" });
    expect(r).toEqual({
      error: false,
      message: "Participation already recorded.",
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("approveRequest", () => {
  it("rejects invalid input", async () => {
    const r = await approveRequest({ eventId: "", userId: "u1" });
    expect(r.error).toBe(true);
  });

  it("returns error when no pending request found", async () => {
    dbMock._updateReturning = [];
    const r = await approveRequest({ eventId: "e1", userId: "u1" });
    expect(r).toEqual({
      error: true,
      message: "No pending request found for this user on this event.",
    });
  });

  it("succeeds and sends email when request is pending", async () => {
    dbMock._updateReturning = [{ userId: "u1" }];
    dbMock.pushSelect([
      {
        name: "Event",
        date: new Date(),
        venue: "Studio",
        notes: null,
      },
    ]); // event for email
    dbMock.pushSelect([{ email: "member@example.com" }]); // user for email
    const r = await approveRequest({ eventId: "e1", userId: "u1" });
    expect(r.error).toBe(false);
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it("returns soft warning when email fails", async () => {
    dbMock._updateReturning = [{ userId: "u1" }];
    dbMock.pushSelect([
      {
        name: "Event",
        date: new Date(),
        venue: "Studio",
        notes: null,
      },
    ]);
    dbMock.pushSelect([{ email: "member@example.com" }]);
    sendEmailMock.mockRejectedValue(new Error("smtp down"));
    const r = await approveRequest({ eventId: "e1", userId: "u1" });
    expect(r.error).toBe(false);
    expect(r.message).toMatch(/email failed/i);
  });
});

describe("rejectRequest", () => {
  it("rejects invalid input", async () => {
    const r = await rejectRequest({ eventId: "", userId: "u1" });
    expect(r.error).toBe(true);
  });

  it("returns error when no pending request found", async () => {
    dbMock._updateReturning = [];
    const r = await rejectRequest({ eventId: "e1", userId: "u1" });
    expect(r).toEqual({
      error: true,
      message: "No pending request found for this user on this event.",
    });
  });

  it("succeeds when request is pending", async () => {
    dbMock._updateReturning = [{ userId: "u1" }];
    const r = await rejectRequest({ eventId: "e1", userId: "u1" });
    expect(r).toEqual({ error: false, message: "Request rejected." });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
