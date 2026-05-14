import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import type { RecentBookingItem } from "./RecentBookingsTable";
import { RecentBookingsTable } from "./RecentBookingsTable";

afterEach(cleanup);

const sampleBookings: RecentBookingItem[] = [
  {
    id: "bkg-1",
    title: "Spring Showcase",
    startAt: new Date("2026-06-15T18:00:00Z"),
    status: "accepted",
    assigneeCount: 4,
  },
  {
    id: "bkg-2",
    title: "Summer Gala",
    startAt: new Date("2026-07-20T20:00:00Z"),
    status: "created",
    assigneeCount: 0,
  },
  {
    id: "bkg-3",
    title: "Autumn Wrap",
    startAt: new Date("2026-09-10T17:00:00Z"),
    status: "cancelled",
    assigneeCount: 2,
  },
];

describe("RecentBookingsTable", () => {
  describe("empty state", () => {
    it("shows empty state text when there are no bookings", () => {
      render(<RecentBookingsTable bookings={[]} />);
      expect(screen.getByText("No bookings yet")).toBeInTheDocument();
    });

    it("shows a link to create a booking in empty state", () => {
      render(<RecentBookingsTable bookings={[]} />);
      const link = screen.getByRole("link", {
        name: /create your first booking/i,
      });
      expect(link).toHaveAttribute("href", "/bookings");
    });

    it("is axe-clean in empty state", async () => {
      const { container } = render(<RecentBookingsTable bookings={[]} />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("with bookings", () => {
    it("renders all booking titles", () => {
      render(<RecentBookingsTable bookings={sampleBookings} />);
      // Titles appear in both mobile cards and desktop table — just assert text exists
      expect(screen.getAllByText("Spring Showcase").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Summer Gala").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Autumn Wrap").length).toBeGreaterThan(0);
    });

    it("links to the correct booking detail page", () => {
      render(<RecentBookingsTable bookings={sampleBookings} />);
      // The desktop table link (one per row in the table)
      const links = screen.getAllByRole("link", { name: "Spring Showcase" });
      // At least one link should point to /bookings/bkg-1
      expect(
        links.some((l) => l.getAttribute("href") === "/bookings/bkg-1"),
      ).toBe(true);
    });

    it("renders status badges for each booking", () => {
      render(<RecentBookingsTable bookings={sampleBookings} />);
      // Status badges appear in both mobile and desktop — just assert at least one each
      expect(screen.getAllByText("Accepted").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Created").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    });

    it("is axe-clean with bookings", async () => {
      const { container } = render(
        <RecentBookingsTable bookings={sampleBookings} />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
