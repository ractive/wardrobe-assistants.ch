// a11y smoke test for BookingDetailActions — uses vitest-axe per the design-system.md baseline.
//
// BookingDetailActions has its own interactive a11y surface: it renders Edit,
// "Message assignees", and Delete buttons directly, plus a TooltipProvider
// wrapper around the disabled Edit button when the booking is in a terminal
// status. The child dialogs (EditBookingDialog, MessageAssigneesDialog,
// DeleteBookingConfirm) open with open=false so their portals are empty and do
// not contribute to the container DOM. Both states (active and closed/terminal)
// are worth testing.

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

import type { BookingDetail } from "../schema";
import { BookingDetailActions } from "./BookingDetailActions";

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
  venueName: "Grand Hall",
  venueCity: "Zurich",
  comment: null,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"),
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

  it("renders cancelled booking (tooltip on disabled Edit) without axe violations", async () => {
    const cancelledBooking: BookingDetail = {
      ...baseBooking,
      status: "cancelled",
    };
    const { container } = render(
      <BookingDetailActions
        booking={cancelledBooking}
        canDelete={false}
        canMessage={false}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
