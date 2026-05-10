import { describe, expect, it } from "vitest";
import {
  approveRequestInput,
  assignUserInput,
  bookingListItem,
  createBookingInput,
  deleteBookingInput,
  messageBookingAssigneesInput,
  myBookingListItem,
  pendingRequest,
  rejectRequestInput,
  requestParticipationInput,
  unassignUserInput,
  updateBookingInput,
} from "./schema";

describe("createBookingInput", () => {
  const valid = {
    name: "Spring kickoff",
    date: new Date("2026-06-01T18:00:00.000Z"),
    venue: "Studio A",
    status: "draft" as const,
  };

  it("accepts a minimal valid booking", () => {
    expect(createBookingInput.safeParse(valid).success).toBe(true);
  });

  it("rejects empty name and venue", () => {
    expect(createBookingInput.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
    expect(
      createBookingInput.safeParse({ ...valid, venue: "  " }).success,
    ).toBe(false);
  });

  it("constrains status to the enum", () => {
    expect(
      createBookingInput.safeParse({ ...valid, status: "tentative" }).success,
    ).toBe(false);
  });

  it("coerces ISO strings into Date", () => {
    const r = createBookingInput.safeParse({
      ...valid,
      date: "2026-06-01T18:00:00.000Z",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.date).toBeInstanceOf(Date);
  });

  it("normalises empty notes to undefined", () => {
    const r = createBookingInput.safeParse({ ...valid, notes: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBeUndefined();
  });

  it("defaults status to draft when omitted", () => {
    const { status: _drop, ...withoutStatus } = valid;
    const r = createBookingInput.safeParse(withoutStatus);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("draft");
  });
});

describe("updateBookingInput", () => {
  const valid = {
    bookingId: "bk-1",
    name: "Updated",
    date: new Date(),
    venue: "Studio B",
    status: "published" as const,
  };

  it("requires bookingId", () => {
    expect(
      updateBookingInput.safeParse({ ...valid, bookingId: "" }).success,
    ).toBe(false);
  });

  it("accepts a valid update", () => {
    expect(updateBookingInput.safeParse(valid).success).toBe(true);
  });
});

describe("deleteBookingInput", () => {
  it("requires a non-empty bookingId", () => {
    expect(deleteBookingInput.safeParse({ bookingId: "" }).success).toBe(false);
    expect(deleteBookingInput.safeParse({ bookingId: "b1" }).success).toBe(
      true,
    );
  });
});

describe("assignUserInput / unassignUserInput", () => {
  it("require both ids", () => {
    expect(
      assignUserInput.safeParse({ bookingId: "", userId: "u1" }).success,
    ).toBe(false);
    expect(
      assignUserInput.safeParse({ bookingId: "b1", userId: "" }).success,
    ).toBe(false);
    expect(
      assignUserInput.safeParse({ bookingId: "b1", userId: "u1" }).success,
    ).toBe(true);
    expect(
      unassignUserInput.safeParse({ bookingId: "b1", userId: "u1" }).success,
    ).toBe(true);
  });
});

describe("messageBookingAssigneesInput", () => {
  it("requires non-empty subject and body", () => {
    expect(
      messageBookingAssigneesInput.safeParse({
        bookingId: "b1",
        subject: "",
        body: "hi",
      }).success,
    ).toBe(false);
    expect(
      messageBookingAssigneesInput.safeParse({
        bookingId: "b1",
        subject: "Hi",
        body: "  ",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid message", () => {
    expect(
      messageBookingAssigneesInput.safeParse({
        bookingId: "b1",
        subject: "Update",
        body: "Hello squad.",
      }).success,
    ).toBe(true);
  });
});

describe("bookingListItem", () => {
  it("rejects an unknown status", () => {
    expect(
      bookingListItem.safeParse({
        id: "b1",
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
  it("requires a non-empty bookingId", () => {
    expect(requestParticipationInput.safeParse({ bookingId: "" }).success).toBe(
      false,
    );
    expect(
      requestParticipationInput.safeParse({ bookingId: "b1" }).success,
    ).toBe(true);
  });
});

describe("approveRequestInput / rejectRequestInput", () => {
  const valid = { bookingId: "b1", userId: "u1" };

  it("requires both ids for approve", () => {
    expect(
      approveRequestInput.safeParse({ bookingId: "", userId: "u1" }).success,
    ).toBe(false);
    expect(
      approveRequestInput.safeParse({ bookingId: "b1", userId: "" }).success,
    ).toBe(false);
    expect(approveRequestInput.safeParse(valid).success).toBe(true);
  });

  it("requires both ids for reject", () => {
    expect(
      rejectRequestInput.safeParse({ bookingId: "", userId: "u1" }).success,
    ).toBe(false);
    expect(
      rejectRequestInput.safeParse({ bookingId: "b1", userId: "" }).success,
    ).toBe(false);
    expect(rejectRequestInput.safeParse(valid).success).toBe(true);
  });
});

describe("myBookingListItem", () => {
  const valid = {
    id: "b1",
    name: "Booking",
    date: new Date(),
    venue: "Venue",
    status: "published" as const,
    assignmentStatus: "assigned" as const,
    createdAt: new Date(),
  };

  it("accepts a valid my-booking item", () => {
    expect(myBookingListItem.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown assignmentStatus", () => {
    expect(
      myBookingListItem.safeParse({ ...valid, assignmentStatus: "pending" })
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
