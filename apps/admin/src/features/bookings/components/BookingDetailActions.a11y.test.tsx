// a11y smoke test for BookingDetailActions — uses vitest-axe per the design-system/a11y.md baseline.
//
// BookingDetailActions renders Edit, "Message assignees", Delete buttons, and a
// timestamps footer. On terminal status (cancelled/rejected) Edit and Message
// assignees are hidden; Delete remains visible.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// All three child dialog components import server actions — mock the module so
// the components render without a Next.js server.
vi.mock("../server/actions", () => ({
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
  deleteBooking: vi.fn(),
  messageBookingAssignees: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Vitest does not auto-cleanup between tests (no globals: true).
// Without explicit cleanup, Radix portals from earlier tests accumulate on
// document.body and cause stale DOM hits on subsequent queries.
afterEach(cleanup);

import type { BookingDetail } from "../schema";
import { BookingDetailActions } from "./BookingDetailActions";

const CREATED_AT = new Date("2026-05-01T08:00:00.000Z");
const UPDATED_AT = new Date("2026-05-10T14:30:00.000Z");

const baseBooking: BookingDetail = {
  id: "booking-1",
  name: "Test Booking",
  date: new Date("2026-06-01"),
  venue: "venue-id",
  notes: null,
  status: "created",
  createdBy: null,
  offerToken: null,
  offerVersion: 0,
  acceptedAt: null,
  invoicedAt: null,
  customerName: "Alice",
  customerEmail: "alice@example.com",
  customerPhone: null,
  startTime: null,
  durationHours: null,
  city: "Zurich",
  comment: null,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  assignees: [],
  pendingRequests: [],
  selections: [],
};

describe("BookingDetailActions a11y", () => {
  it("renders active booking without axe violations", async () => {
    const { container } = render(
      <BookingDetailActions
        booking={baseBooking}
        canDelete={true}
        canMessage={true}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders cancelled booking (lifecycle actions hidden, Delete visible) without axe violations", async () => {
    const cancelledBooking: BookingDetail = {
      ...baseBooking,
      status: "cancelled",
    };
    const { container } = render(
      <BookingDetailActions
        booking={cancelledBooking}
        canDelete={true}
        canMessage={false}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("hides Edit and Message assignees on terminal status", () => {
    const { queryByRole } = render(
      <BookingDetailActions
        booking={{ ...baseBooking, status: "rejected" }}
        canDelete={true}
        canMessage={true}
      />,
    );
    expect(queryByRole("button", { name: "Edit" })).toBeNull();
    expect(queryByRole("button", { name: "Message assignees" })).toBeNull();
    // Delete stays visible
    expect(queryByRole("button", { name: "Delete" })).not.toBeNull();
  });

  it("shows timestamps footer with ISO title attrs", () => {
    const { getAllByTitle } = render(
      <BookingDetailActions
        booking={baseBooking}
        canDelete={false}
        canMessage={false}
      />,
    );
    // createdAt and updatedAt are distinct — each title attr matches exactly one span
    expect(getAllByTitle(CREATED_AT.toISOString())).toHaveLength(1);
    expect(getAllByTitle(UPDATED_AT.toISOString())).toHaveLength(1);
  });
});
