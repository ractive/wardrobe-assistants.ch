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
  // iter-37 §C.2+C.3: startTime, durationHours (≥5), venueCity are now
  // required for new bookings at the app layer.
  const valid = {
    name: "Spring kickoff",
    date: new Date("2026-06-01T18:00:00.000Z"),
    venue: "Studio A",
    startTime: "18:00",
    durationHours: 8,
    venueCity: "Zurich",
  };

  it("accepts a minimal valid booking with required fields", () => {
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

  it("accepts optional customer contact fields", () => {
    const r = createBookingInput.safeParse({
      ...valid,
      customerName: "Alice",
      customerEmail: "alice@example.com",
      customerPhone: "+41 79 123 45 67",
    });
    expect(r.success).toBe(true);
  });

  // iter-37 §C.2: hard 5h minimum on new bookings.
  it("rejects durationHours below 5", () => {
    expect(
      createBookingInput.safeParse({ ...valid, durationHours: 4 }).success,
    ).toBe(false);
    expect(
      createBookingInput.safeParse({ ...valid, durationHours: 1 }).success,
    ).toBe(false);
    expect(
      createBookingInput.safeParse({ ...valid, durationHours: 0 }).success,
    ).toBe(false);
  });

  it("accepts durationHours of exactly 5", () => {
    const r = createBookingInput.safeParse({ ...valid, durationHours: 5 });
    expect(r.success).toBe(true);
  });

  // iter-37 §C.3: startTime required for new bookings.
  it("rejects missing or empty startTime", () => {
    expect(
      createBookingInput.safeParse({ ...valid, startTime: undefined }).success,
    ).toBe(false);
    expect(
      createBookingInput.safeParse({ ...valid, startTime: "" }).success,
    ).toBe(false);
    expect(
      createBookingInput.safeParse({ ...valid, startTime: "25:00" }).success,
    ).toBe(false);
  });

  // iter-37 §C.3: venueCity required for new bookings.
  it("rejects missing or empty venueCity", () => {
    expect(
      createBookingInput.safeParse({ ...valid, venueCity: "" }).success,
    ).toBe(false);
    expect(
      createBookingInput.safeParse({ ...valid, venueCity: undefined }).success,
    ).toBe(false);
  });

  // iter-37 §C.5: customerEmail validated as proper email.
  it("rejects malformed customerEmail", () => {
    expect(
      createBookingInput.safeParse({ ...valid, customerEmail: "not-an-email" })
        .success,
    ).toBe(false);
    expect(
      createBookingInput.safeParse({ ...valid, customerEmail: "@missing.com" })
        .success,
    ).toBe(false);
  });

  it("accepts valid customerEmail and normalises empty to undefined", () => {
    const filled = createBookingInput.safeParse({
      ...valid,
      customerEmail: "alice@example.com",
    });
    expect(filled.success).toBe(true);

    const empty = createBookingInput.safeParse({
      ...valid,
      customerEmail: "",
    });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.customerEmail).toBeUndefined();
  });
});

describe("updateBookingInput — relaxed validation for edits", () => {
  const validUpdate = {
    bookingId: "bk-1",
    name: "Updated",
    date: new Date("2024-01-01T18:00:00.000Z"), // past date — allowed on edit
    venue: "Studio B",
  };

  // iter-37 §C.2: edit allows sub-5h duration so admins can fix legacy rows.
  it("accepts durationHours below 5 on edit", () => {
    expect(
      updateBookingInput.safeParse({ ...validUpdate, durationHours: 3 })
        .success,
    ).toBe(true);
    expect(
      updateBookingInput.safeParse({ ...validUpdate, durationHours: 1 })
        .success,
    ).toBe(true);
  });

  // iter-37 §C.1: edit does not restrict past dates (no date restriction at schema level).
  it("accepts past dates on edit", () => {
    const r = updateBookingInput.safeParse({
      ...validUpdate,
      date: new Date("2020-01-01"),
    });
    expect(r.success).toBe(true);
  });

  // iter-37 §C.3: edit allows missing startTime/venueCity (legacy rows).
  it("accepts missing startTime and venueCity on edit", () => {
    const r = updateBookingInput.safeParse({
      ...validUpdate,
      startTime: undefined,
      venueCity: undefined,
    });
    expect(r.success).toBe(true);
  });

  // iter-37 §C.5: email still validated on edit.
  it("rejects malformed customerEmail on edit", () => {
    expect(
      updateBookingInput.safeParse({
        ...validUpdate,
        customerEmail: "not-an-email",
      }).success,
    ).toBe(false);
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
        isPublicRequest: false,
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
    status: "accepted" as const,
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
