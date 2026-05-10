import { describe, expect, it } from "vitest";
import {
  approveRequestInput,
  assignUserInput,
  createEventInput,
  deleteEventInput,
  eventListItem,
  messageEventAssigneesInput,
  myEventListItem,
  pendingRequest,
  rejectRequestInput,
  requestParticipationInput,
  unassignUserInput,
  updateEventInput,
} from "./schema";

describe("createEventInput", () => {
  const valid = {
    name: "Spring kickoff",
    date: new Date("2026-06-01T18:00:00.000Z"),
    venue: "Studio A",
    status: "draft" as const,
  };

  it("accepts a minimal valid event", () => {
    expect(createEventInput.safeParse(valid).success).toBe(true);
  });

  it("rejects empty name and venue", () => {
    expect(createEventInput.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
    expect(createEventInput.safeParse({ ...valid, venue: "  " }).success).toBe(
      false,
    );
  });

  it("constrains status to the enum", () => {
    expect(
      createEventInput.safeParse({ ...valid, status: "tentative" }).success,
    ).toBe(false);
  });

  it("coerces ISO strings into Date", () => {
    const r = createEventInput.safeParse({
      ...valid,
      date: "2026-06-01T18:00:00.000Z",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.date).toBeInstanceOf(Date);
  });

  it("normalises empty notes to undefined", () => {
    const r = createEventInput.safeParse({ ...valid, notes: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBeUndefined();
  });

  it("defaults status to draft when omitted", () => {
    const { status: _drop, ...withoutStatus } = valid;
    const r = createEventInput.safeParse(withoutStatus);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("draft");
  });
});

describe("updateEventInput", () => {
  const valid = {
    eventId: "evt-1",
    name: "Updated",
    date: new Date(),
    venue: "Studio B",
    status: "published" as const,
  };

  it("requires eventId", () => {
    expect(updateEventInput.safeParse({ ...valid, eventId: "" }).success).toBe(
      false,
    );
  });

  it("accepts a valid update", () => {
    expect(updateEventInput.safeParse(valid).success).toBe(true);
  });
});

describe("deleteEventInput", () => {
  it("requires a non-empty eventId", () => {
    expect(deleteEventInput.safeParse({ eventId: "" }).success).toBe(false);
    expect(deleteEventInput.safeParse({ eventId: "e1" }).success).toBe(true);
  });
});

describe("assignUserInput / unassignUserInput", () => {
  it("require both ids", () => {
    expect(
      assignUserInput.safeParse({ eventId: "", userId: "u1" }).success,
    ).toBe(false);
    expect(
      assignUserInput.safeParse({ eventId: "e1", userId: "" }).success,
    ).toBe(false);
    expect(
      assignUserInput.safeParse({ eventId: "e1", userId: "u1" }).success,
    ).toBe(true);
    expect(
      unassignUserInput.safeParse({ eventId: "e1", userId: "u1" }).success,
    ).toBe(true);
  });
});

describe("messageEventAssigneesInput", () => {
  it("requires non-empty subject and body", () => {
    expect(
      messageEventAssigneesInput.safeParse({
        eventId: "e1",
        subject: "",
        body: "hi",
      }).success,
    ).toBe(false);
    expect(
      messageEventAssigneesInput.safeParse({
        eventId: "e1",
        subject: "Hi",
        body: "  ",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid message", () => {
    expect(
      messageEventAssigneesInput.safeParse({
        eventId: "e1",
        subject: "Update",
        body: "Hello squad.",
      }).success,
    ).toBe(true);
  });
});

describe("eventListItem", () => {
  it("rejects an unknown status", () => {
    expect(
      eventListItem.safeParse({
        id: "e1",
        name: "x",
        date: new Date(),
        venue: "v",
        status: "tentative",
        assigneesCount: 0,
        createdAt: new Date(),
      }).success,
    ).toBe(false);
  });
});

describe("requestParticipationInput", () => {
  it("requires a non-empty eventId", () => {
    expect(requestParticipationInput.safeParse({ eventId: "" }).success).toBe(
      false,
    );
    expect(requestParticipationInput.safeParse({ eventId: "e1" }).success).toBe(
      true,
    );
  });
});

describe("approveRequestInput / rejectRequestInput", () => {
  const valid = { eventId: "e1", userId: "u1" };

  it("requires both ids for approve", () => {
    expect(
      approveRequestInput.safeParse({ eventId: "", userId: "u1" }).success,
    ).toBe(false);
    expect(
      approveRequestInput.safeParse({ eventId: "e1", userId: "" }).success,
    ).toBe(false);
    expect(approveRequestInput.safeParse(valid).success).toBe(true);
  });

  it("requires both ids for reject", () => {
    expect(
      rejectRequestInput.safeParse({ eventId: "", userId: "u1" }).success,
    ).toBe(false);
    expect(
      rejectRequestInput.safeParse({ eventId: "e1", userId: "" }).success,
    ).toBe(false);
    expect(rejectRequestInput.safeParse(valid).success).toBe(true);
  });
});

describe("myEventListItem", () => {
  const valid = {
    id: "e1",
    name: "Event",
    date: new Date(),
    venue: "Venue",
    status: "published" as const,
    assignmentStatus: "assigned" as const,
    createdAt: new Date(),
  };

  it("accepts a valid my-event item", () => {
    expect(myEventListItem.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown assignmentStatus", () => {
    expect(
      myEventListItem.safeParse({ ...valid, assignmentStatus: "pending" })
        .success,
    ).toBe(false);
  });
});

describe("pendingRequest", () => {
  const valid = {
    userId: "u1",
    displayName: "Test User",
    email: "test@example.com",
    requestedAt: new Date(),
  };

  it("accepts a valid pending request", () => {
    expect(pendingRequest.safeParse(valid).success).toBe(true);
  });

  it("requires userId", () => {
    expect(
      pendingRequest.safeParse({ ...valid, userId: undefined }).success,
    ).toBe(false);
  });
});
