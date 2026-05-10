import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import type { MyEventListItem } from "../schema";
import { MyEventsTable } from "./MyEventsTable";

afterEach(() => {
  cleanup();
});

const baseEvent: MyEventListItem = {
  id: "e1",
  name: "Spring kickoff",
  date: new Date("2026-06-01T18:00:00.000Z"),
  venue: "Studio A",
  status: "published",
  assignmentStatus: "assigned",
  createdAt: new Date("2026-01-01"),
};

describe("MyEventsTable", () => {
  it("renders the empty state message when no events", () => {
    render(<MyEventsTable events={[]} />);
    expect(screen.getByText(/no events found/i)).toBeInTheDocument();
  });

  it("renders a custom empty message when provided", () => {
    render(<MyEventsTable events={[]} emptyMessage="Nothing here." />);
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders event names when events are provided", () => {
    render(<MyEventsTable events={[baseEvent]} />);
    // Both mobile and desktop renders appear in DOM; at least one is visible
    const names = screen.getAllByText("Spring kickoff");
    expect(names.length).toBeGreaterThan(0);
  });

  it("shows the assignment status badge", () => {
    render(<MyEventsTable events={[baseEvent]} />);
    const badges = screen.getAllByText("Assigned");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("shows 'Requested' badge for requested status", () => {
    render(
      <MyEventsTable
        events={[{ ...baseEvent, assignmentStatus: "requested" }]}
      />,
    );
    const badges = screen.getAllByText("Requested");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("shows 'Rejected' badge for rejected status", () => {
    render(
      <MyEventsTable
        events={[{ ...baseEvent, assignmentStatus: "rejected" }]}
      />,
    );
    const badges = screen.getAllByText("Rejected");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("is axe-clean (empty)", async () => {
    const { container } = render(<MyEventsTable events={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean (with events)", async () => {
    const { container } = render(
      <MyEventsTable
        events={[
          baseEvent,
          { ...baseEvent, id: "e2", assignmentStatus: "requested" },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
