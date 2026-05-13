// Unit tests for AssignmentActionPrompt.
//
// The component renders Confirm/Decline buttons when defaultAction is non-null.
// The page (/my-bookings/[bookingId]) is responsible for NOT rendering this
// component when the booking status is "cancelled" — see the isTerminal guard
// in that page. These tests confirm the component's own rendering contract.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/assignment-actions", () => ({
  confirmAssignment: vi.fn(),
  declineAssignment: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/my-bookings/booking-1",
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

afterEach(cleanup);

import { AssignmentActionPrompt } from "./AssignmentActionPrompt";

describe("AssignmentActionPrompt", () => {
  it("renders nothing when defaultAction is null", () => {
    const { container } = render(
      <AssignmentActionPrompt bookingId="booking-1" defaultAction={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Confirm and Decline buttons when defaultAction is 'confirm'", () => {
    render(
      <AssignmentActionPrompt bookingId="booking-1" defaultAction="confirm" />,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDefined();
  });

  it("renders Confirm and Decline buttons when defaultAction is 'decline'", () => {
    render(
      <AssignmentActionPrompt bookingId="booking-1" defaultAction="decline" />,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDefined();
  });
});
