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
    const sendMock = email.sendEmail as unknown as ReturnType<typeof vi.fn>;
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
    const sendMock = email.sendEmail as unknown as ReturnType<typeof vi.fn>;

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

    sendMock.mockClear();
    const r = await harness.runAs(admin.cookies, () =>
      messageEventAssignees({
        eventId: event.id,
        subject: "Heads up",
        body: "See you there.",
      }),
    );
    expect(r.error).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(2);
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
    const sendMock = email.sendEmail as unknown as ReturnType<typeof vi.fn>;

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

    sendMock.mockClear();
    const r = await harness.runAs(admin.cookies, () =>
      messageEventAssignees({
        eventId: event.id,
        subject: "Heads up\r\nBcc: attacker@example.com",
        body: "See you there.",
      }),
    );
    expect(r.error, JSON.stringify(r)).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const subjectArg = sendMock.mock.calls[0]?.[0]?.subject;
    expect(subjectArg).toBeDefined();
    expect(subjectArg).not.toMatch(/[\r\n]/);
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
