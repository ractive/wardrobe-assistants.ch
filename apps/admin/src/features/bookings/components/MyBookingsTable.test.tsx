import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import type { MyBookingListItem } from "../schema";
import { MyBookingsTable } from "./MyBookingsTable";

afterEach(() => {
  cleanup();
});

const baseBooking: MyBookingListItem = {
  id: "b1",
  name: "Spring kickoff",
  date: new Date("2026-06-01T18:00:00.000Z"),
  venue: "Studio A",
  status: "published",
  assignmentStatus: "assigned",
  createdAt: new Date("2026-01-01"),
};

describe("MyBookingsTable", () => {
  it("renders the empty state message when no bookings", () => {
    render(<MyBookingsTable bookings={[]} />);
    expect(screen.getByText(/no bookings found/i)).toBeInTheDocument();
  });

  it("renders a custom empty message when provided", () => {
    render(<MyBookingsTable bookings={[]} emptyMessage="Nothing here." />);
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders booking names when bookings are provided", () => {
    render(<MyBookingsTable bookings={[baseBooking]} />);
    // Both mobile and desktop renders appear in DOM; at least one is visible
    const names = screen.getAllByText("Spring kickoff");
    expect(names.length).toBeGreaterThan(0);
  });

  it("shows the assignment status badge", () => {
    render(<MyBookingsTable bookings={[baseBooking]} />);
    const badges = screen.getAllByText("Assigned");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("shows 'Requested' badge for requested status", () => {
    render(
      <MyBookingsTable
        bookings={[{ ...baseBooking, assignmentStatus: "requested" }]}
      />,
    );
    const badges = screen.getAllByText("Requested");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("shows 'Rejected' badge for rejected status", () => {
    render(
      <MyBookingsTable
        bookings={[{ ...baseBooking, assignmentStatus: "rejected" }]}
      />,
    );
    const badges = screen.getAllByText("Rejected");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("is axe-clean (empty)", async () => {
    const { container } = render(<MyBookingsTable bookings={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean (with bookings)", async () => {
    const { container } = render(
      <MyBookingsTable
        bookings={[
          baseBooking,
          { ...baseBooking, id: "b2", assignmentStatus: "requested" },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
