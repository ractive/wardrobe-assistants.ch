import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import type { RecentEventItem } from "./RecentEventsTable";
import { RecentEventsTable } from "./RecentEventsTable";

afterEach(cleanup);

const sampleEvents: RecentEventItem[] = [
  {
    id: "evt-1",
    title: "Spring Showcase",
    startAt: new Date("2026-06-15T18:00:00Z"),
    status: "published",
    assigneeCount: 4,
  },
  {
    id: "evt-2",
    title: "Summer Gala",
    startAt: new Date("2026-07-20T20:00:00Z"),
    status: "draft",
    assigneeCount: 0,
  },
  {
    id: "evt-3",
    title: "Autumn Wrap",
    startAt: new Date("2026-09-10T17:00:00Z"),
    status: "cancelled",
    assigneeCount: 2,
  },
];

describe("RecentEventsTable", () => {
  describe("empty state", () => {
    it("shows empty state text when there are no events", () => {
      render(<RecentEventsTable events={[]} />);
      expect(screen.getByText("No events yet")).toBeInTheDocument();
    });

    it("shows a link to create an event in empty state", () => {
      render(<RecentEventsTable events={[]} />);
      const link = screen.getByRole("link", {
        name: /create your first event/i,
      });
      expect(link).toHaveAttribute("href", "/events/new");
    });

    it("is axe-clean in empty state", async () => {
      const { container } = render(<RecentEventsTable events={[]} />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("with events", () => {
    it("renders all event titles", () => {
      render(<RecentEventsTable events={sampleEvents} />);
      // Titles appear in both mobile cards and desktop table — just assert text exists
      expect(screen.getAllByText("Spring Showcase").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Summer Gala").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Autumn Wrap").length).toBeGreaterThan(0);
    });

    it("links to the correct event detail page", () => {
      render(<RecentEventsTable events={sampleEvents} />);
      // The desktop table link (one per row in the table)
      const links = screen.getAllByRole("link", { name: "Spring Showcase" });
      // At least one link should point to /events/evt-1
      expect(
        links.some((l) => l.getAttribute("href") === "/events/evt-1"),
      ).toBe(true);
    });

    it("renders status badges for each event", () => {
      render(<RecentEventsTable events={sampleEvents} />);
      // Status badges appear in both mobile and desktop — just assert at least one each
      expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    });

    it("is axe-clean with events", async () => {
      const { container } = render(<RecentEventsTable events={sampleEvents} />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
