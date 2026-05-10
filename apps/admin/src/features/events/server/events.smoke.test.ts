// @vitest-environment node
//
// Smoke test for the events feature — exercises the real auth + permission
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

describe("events feature — smoke", () => {
  beforeAll(async () => {
    harness = await setupHarness();
  });

  afterAll(() => {
    harness.cleanup();
  });

  it("admin can create an event and it shows up in listEvents()", async () => {
    const admin = await harness.seedAdmin({
      email: "admin1@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createEvent } = await import("./actions");
    const { listEvents } = await import("./queries");

    const result = await harness.runAs(admin.cookies, () =>
      createEvent({
        name: "Spring kickoff",
        date: new Date("2026-06-01T18:00:00.000Z"),
        venue: "Studio A",
        notes: undefined,
        status: "draft",
      }),
    );
    expect(result.error, JSON.stringify(result)).toBe(false);

    const list = await harness.runAs(admin.cookies, () => listEvents());
    expect(list.map((e) => e.name)).toContain("Spring kickoff");
  });

  it("squad member is denied EVENT_CREATE — withPermission throws", async () => {
    const sm = await harness.seedSquadMember({
      email: "sm1@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createEvent } = await import("./actions");
    await expect(
      harness.runAs(sm.cookies, () =>
        createEvent({
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
      email: "admin2@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "member@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const sendMock = email.sendTemplated as unknown as ReturnType<typeof vi.fn>;
    sendMock.mockClear();

    const { createEvent, assignUser } = await import("./actions");
    const { getEventById, listEvents } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createEvent({
        name: "Idempotent test",
        date: new Date("2026-07-01T18:00:00.000Z"),
        venue: "Studio B",
        notes: undefined,
        status: "draft",
      }),
    );
    const eventRow = (
      await harness.runAs(admin.cookies, () => listEvents())
    ).find((e) => e.name === "Idempotent test");
    expect(eventRow).toBeDefined();
    if (!eventRow) return;

    const r1 = await harness.runAs(admin.cookies, () =>
      assignUser({ eventId: eventRow.id, userId: member.userId }),
    );
    expect(r1.error).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const r2 = await harness.runAs(admin.cookies, () =>
      assignUser({ eventId: eventRow.id, userId: member.userId }),
    );
    expect(r2.error).toBe(false);
    if (!r2.error) {
      expect(r2.message).toMatch(/already assigned/i);
    }
    expect(sendMock).toHaveBeenCalledTimes(1);

    const detail = await harness.runAs(admin.cookies, () =>
      getEventById(eventRow.id),
    );
    expect(detail?.assignees).toHaveLength(1);
  });

  it("messageEventAssignees fans out one email per assignee", async () => {
    const admin = await harness.seedAdmin({
      email: "admin3@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const m1 = await harness.seedSquadMember({
      email: "m1@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const m2 = await harness.seedSquadMember({
      email: "m2@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const batchMock = email.sendTemplatedBatch as unknown as ReturnType<
      typeof vi.fn
    >;

    const { createEvent, assignUser, messageEventAssignees } = await import(
      "./actions"
    );
    const { listEvents } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createEvent({
        name: "Fanout test",
        date: new Date("2026-08-01T18:00:00.000Z"),
        venue: "Studio C",
        notes: undefined,
        status: "published",
      }),
    );
    const event = (await harness.runAs(admin.cookies, () => listEvents())).find(
      (e) => e.name === "Fanout test",
    );
    expect(event).toBeDefined();
    if (!event) return;

    await harness.runAs(admin.cookies, () =>
      assignUser({ eventId: event.id, userId: m1.userId }),
    );
    await harness.runAs(admin.cookies, () =>
      assignUser({ eventId: event.id, userId: m2.userId }),
    );

    batchMock.mockClear();
    batchMock.mockResolvedValue({ sent: 2, failed: 0 });
    const r = await harness.runAs(admin.cookies, () =>
      messageEventAssignees({
        eventId: event.id,
        subject: "Heads up",
        body: "See you there.",
      }),
    );
    expect(r.error).toBe(false);
    // sendTemplatedBatch is called once with all 2 recipients.
    expect(batchMock).toHaveBeenCalledOnce();
    const batchRecipients = batchMock.mock.calls[0]?.[1] as unknown[];
    expect(batchRecipients).toHaveLength(2);
  });

  it("messageEventAssignees strips CR/LF from subject (header-injection guard)", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-crlf@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const m = await harness.seedSquadMember({
      email: "m-crlf@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const batchMock = email.sendTemplatedBatch as unknown as ReturnType<
      typeof vi.fn
    >;

    const { createEvent, assignUser, messageEventAssignees } = await import(
      "./actions"
    );
    const { listEvents } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createEvent({
        name: "CRLF guard",
        date: new Date("2026-10-01T18:00:00.000Z"),
        venue: "Studio E",
        notes: undefined,
        status: "published",
      }),
    );
    const event = (await harness.runAs(admin.cookies, () => listEvents())).find(
      (e) => e.name === "CRLF guard",
    );
    expect(event).toBeDefined();
    if (!event) return;

    await harness.runAs(admin.cookies, () =>
      assignUser({ eventId: event.id, userId: m.userId }),
    );

    batchMock.mockClear();
    batchMock.mockResolvedValue({ sent: 1, failed: 0 });
    const r = await harness.runAs(admin.cookies, () =>
      messageEventAssignees({
        eventId: event.id,
        subject: "Heads up\r\nBcc: attacker@example.com",
        body: "See you there.",
      }),
    );
    expect(r.error, JSON.stringify(r)).toBe(false);
    expect(batchMock).toHaveBeenCalledOnce();
    // The subject passed to sendTemplatedBatch must be CR/LF-stripped.
    const batchRecipients = batchMock.mock.calls[0]?.[1] as Array<{
      params: { subject: string };
    }>;
    const subjectArg = batchRecipients?.[0]?.params?.subject;
    expect(subjectArg).toBeDefined();
    expect(subjectArg).not.toMatch(/[\r\n]/);
  });

  it("squad member can request participation on a published future event; admin approves; member sees it as assigned", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-req@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "member-req@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const sendMock = email.sendTemplated as unknown as ReturnType<typeof vi.fn>;
    const batchMock = email.sendTemplatedBatch as unknown as ReturnType<
      typeof vi.fn
    >;
    sendMock.mockClear();
    batchMock.mockClear();
    batchMock.mockResolvedValue({ sent: 1, failed: 0 });

    const { createEvent, requestParticipation, approveRequest } = await import(
      "./actions"
    );
    const { listEvents, listMyAssignedEvents, listMyRequests, getEventById } =
      await import("./queries");

    // Admin creates a published future event
    await harness.runAs(admin.cookies, () =>
      createEvent({
        name: "Request flow test",
        date: new Date("2027-01-15T18:00:00.000Z"),
        venue: "Studio Req",
        notes: undefined,
        status: "published",
      }),
    );
    const eventList = await harness.runAs(admin.cookies, () => listEvents());
    const event = eventList.find((e) => e.name === "Request flow test");
    expect(event).toBeDefined();
    if (!event) return;

    // Squad member requests participation
    const reqResult = await harness.runAs(member.cookies, () =>
      requestParticipation({ eventId: event.id }),
    );
    expect(reqResult.error, JSON.stringify(reqResult)).toBe(false);

    // Admin(s) get notified via sendTemplatedBatch (fire-and-forget).
    // At least one batch call is made (multiple admins may exist from previous
    // smoke tests seeded in the same DB).
    expect(batchMock.mock.calls.length).toBeGreaterThanOrEqual(1);

    // Member sees it in "Your requests"
    const requests = await harness.runAs(member.cookies, () =>
      listMyRequests(member.userId),
    );
    expect(requests.map((r) => r.id)).toContain(event.id);
    const reqItem = requests.find((r) => r.id === event.id);
    expect(reqItem?.assignmentStatus).toBe("requested");

    // Admin sees pending request on event detail
    sendMock.mockClear();
    const detail = await harness.runAs(admin.cookies, () =>
      getEventById(event.id),
    );
    expect(detail?.pendingRequests).toHaveLength(1);
    expect(detail?.pendingRequests[0]?.userId).toBe(member.userId);

    // Admin approves
    const approveResult = await harness.runAs(admin.cookies, () =>
      approveRequest({ eventId: event.id, userId: member.userId }),
    );
    expect(approveResult.error, JSON.stringify(approveResult)).toBe(false);
    // Assignment email sent to member via sendTemplated.
    expect(sendMock).toHaveBeenCalledOnce();

    // Member now sees it in "Assigned to you"
    const assigned = await harness.runAs(member.cookies, () =>
      listMyAssignedEvents(member.userId),
    );
    expect(assigned.map((e) => e.id)).toContain(event.id);
    const assignedItem = assigned.find((e) => e.id === event.id);
    expect(assignedItem?.assignmentStatus).toBe("assigned");

    // No longer in requests
    const reqsAfter = await harness.runAs(member.cookies, () =>
      listMyRequests(member.userId),
    );
    expect(reqsAfter.map((r) => r.id)).not.toContain(event.id);
  });

  it("squad member cannot request participation on a draft event", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-draft@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "member-draft@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createEvent, requestParticipation } = await import("./actions");
    const { listEvents } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createEvent({
        name: "Draft event",
        date: new Date("2027-02-01T18:00:00.000Z"),
        venue: "Studio Draft",
        notes: undefined,
        status: "draft",
      }),
    );
    const eventList = await harness.runAs(admin.cookies, () => listEvents());
    const event = eventList.find((e) => e.name === "Draft event");
    expect(event).toBeDefined();
    if (!event) return;

    const result = await harness.runAs(member.cookies, () =>
      requestParticipation({ eventId: event.id }),
    );
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/published/i);
  });

  it("squad member cannot approveRequest — PermissionError", async () => {
    const member = await harness.seedSquadMember({
      email: "member-approver@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { approveRequest } = await import("./actions");
    await expect(
      harness.runAs(member.cookies, () =>
        approveRequest({ eventId: "any", userId: "any" }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError" });
  });

  it("already-assigned member calling requestParticipation is a no-op", async () => {
    const admin = await harness.seedAdmin({
      email: "admin-noop@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "member-noop@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const email = await import("@/lib/email");
    const batchMock = email.sendTemplatedBatch as unknown as ReturnType<
      typeof vi.fn
    >;

    const { createEvent, assignUser, requestParticipation } = await import(
      "./actions"
    );
    const { listEvents, listUpcomingEventsForRequest } = await import(
      "./queries"
    );

    await harness.runAs(admin.cookies, () =>
      createEvent({
        name: "Already assigned event",
        date: new Date("2027-03-01T18:00:00.000Z"),
        venue: "Studio Noop",
        notes: undefined,
        status: "published",
      }),
    );
    const eventList = await harness.runAs(admin.cookies, () => listEvents());
    const event = eventList.find((e) => e.name === "Already assigned event");
    expect(event).toBeDefined();
    if (!event) return;

    // Admin directly assigns the member
    await harness.runAs(admin.cookies, () =>
      assignUser({ eventId: event.id, userId: member.userId }),
    );

    // Event should NOT appear in upcoming-events-for-request (already assigned)
    const upcoming = await harness.runAs(member.cookies, () =>
      listUpcomingEventsForRequest(member.userId),
    );
    expect(upcoming.map((e) => e.id)).not.toContain(event.id);

    // Member tries to request anyway — idempotent (onConflictDoNothing).
    // The action returns early without fanning out admin emails so repeated
    // clicks can't spam admins.
    batchMock.mockClear();
    const result = await harness.runAs(member.cookies, () =>
      requestParticipation({ eventId: event.id }),
    );
    expect(result.error).toBe(false);
    expect(batchMock).toHaveBeenCalledTimes(0);
  });

  it("admin can delete an event — cascade removes assignments", async () => {
    const admin = await harness.seedAdmin({
      email: "admin4@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });
    const member = await harness.seedSquadMember({
      email: "deletetest@events-smoke.local",
      password: "Sup3rSecure!Pass",
    });

    const { createEvent, assignUser, deleteEvent } = await import("./actions");
    const { listEvents, getEventById } = await import("./queries");

    await harness.runAs(admin.cookies, () =>
      createEvent({
        name: "To be deleted",
        date: new Date("2026-09-01T18:00:00.000Z"),
        venue: "Studio D",
        notes: undefined,
        status: "draft",
      }),
    );
    const event = (await harness.runAs(admin.cookies, () => listEvents())).find(
      (e) => e.name === "To be deleted",
    );
    expect(event).toBeDefined();
    if (!event) return;

    await harness.runAs(admin.cookies, () =>
      assignUser({ eventId: event.id, userId: member.userId }),
    );

    const r = await harness.runAs(admin.cookies, () =>
      deleteEvent({ eventId: event.id }),
    );
    expect(r.error).toBe(false);

    expect(
      await harness.runAs(admin.cookies, () => getEventById(event.id)),
    ).toBeNull();
    expect(
      (await harness.runAs(admin.cookies, () => listEvents()))
        .map((e) => e.id)
        .includes(event.id),
    ).toBe(false);
  });
});
