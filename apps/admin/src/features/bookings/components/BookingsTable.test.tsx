import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import type { BookingListItem } from "../schema";
import { BookingsTable } from "./BookingsTable";

afterEach(() => cleanup());

const baseBooking: BookingListItem = {
  id: "b1",
  name: "Spring kickoff",
  date: new Date("2026-06-01T18:00:00.000Z"),
  venue: "Studio A",
  status: "accepted",
  assigneesCount: 3,
  isPublicRequest: false,
  createdAt: new Date("2026-01-01"),
};

describe("BookingsTable", () => {
  it("renders empty state when no bookings", () => {
    render(<BookingsTable bookings={[]} />);
    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it("renders booking names when bookings are provided", () => {
    render(<BookingsTable bookings={[baseBooking]} />);
    const names = screen.getAllByText("Spring kickoff");
    expect(names.length).toBeGreaterThan(0);
  });

  it("desktop table row contains a link to /bookings/<id>", () => {
    const { container } = render(<BookingsTable bookings={[baseBooking]} />);
    // The primary link (aria-label) in the desktop table wraps the name cell.
    const primaryLink = container.querySelector(
      `a[aria-label="Open booking Spring kickoff"]`,
    );
    expect(primaryLink).not.toBeNull();
    expect(primaryLink?.getAttribute("href")).toBe("/bookings/b1");
  });

  it("all desktop table row links point to the correct booking URL", () => {
    const { container } = render(
      <BookingsTable
        bookings={[
          baseBooking,
          { ...baseBooking, id: "b2", name: "Summer show" },
        ]}
      />,
    );
    // Every link in the table body should target one of the booking hrefs.
    const tableBody = container.querySelector("tbody");
    expect(tableBody).not.toBeNull();
    const links = within(tableBody!).getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/bookings/b1");
    expect(hrefs).toContain("/bookings/b2");
    // No link should point outside the bookings path.
    for (const href of hrefs) {
      expect(href).toMatch(/^\/bookings\//);
    }
  });

  it("shows Public request badge when isPublicRequest is true", () => {
    render(
      <BookingsTable bookings={[{ ...baseBooking, isPublicRequest: true }]} />,
    );
    expect(screen.getAllByText("Public request").length).toBeGreaterThan(0);
  });

  it("shows pending requests badge when count > 0", () => {
    const map = new Map([["b1", 2]]);
    render(
      <BookingsTable
        bookings={[baseBooking]}
        pendingRequestsCountByBooking={map}
      />,
    );
    expect(
      screen.getAllByLabelText(/2 pending requests/i).length,
    ).toBeGreaterThan(0);
  });

  it("is axe-clean (empty state)", async () => {
    const { container } = render(<BookingsTable bookings={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean (with bookings)", async () => {
    const { container } = render(
      <BookingsTable
        bookings={[
          baseBooking,
          {
            ...baseBooking,
            id: "b2",
            name: "Summer show",
            status: "offered",
          },
        ]}
      />,
    );
    expect(
      await axe(container, {
        rules: {
          // Rendered outside a landmark region in unit tests.
          region: { enabled: false },
        },
      }),
    ).toHaveNoViolations();
  });
});
