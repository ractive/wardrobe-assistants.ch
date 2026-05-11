import { render, screen, within } from "@testing-library/react";
import { CalendarClock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { KpiCard } from "./KpiCard";

describe("KpiCard", () => {
  it("renders the title and a numeric value", () => {
    render(<KpiCard title="Upcoming events" value={42} icon={CalendarClock} />);
    expect(screen.getByText("Upcoming events")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders the title and a dash placeholder value", () => {
    render(<KpiCard title="Open invoices" value="—" icon={CalendarClock} />);
    expect(screen.getByText("Open invoices")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an optional description when provided", () => {
    render(
      <KpiCard
        title="Active squad"
        value={5}
        icon={CalendarClock}
        description="Admins and squad members"
      />,
    );
    expect(screen.getByText("Admins and squad members")).toBeInTheDocument();
  });

  it("does not render a description element when omitted", () => {
    const { container } = render(
      <KpiCard title="Active squad" value={5} icon={CalendarClock} />,
    );
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders as a link when href is provided", () => {
    const { container } = render(
      <KpiCard
        title="New requests"
        value={3}
        icon={CalendarClock}
        href="/bookings?status=new-requests"
      />,
    );
    const link = within(container).getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/bookings?status=new-requests");
  });

  it("does not render a link element when href is omitted", () => {
    const { container } = render(
      <KpiCard title="No-link card" value={5} icon={CalendarClock} />,
    );
    expect(within(container).queryByRole("link")).toBeNull();
  });

  it("is axe-clean with a numeric value", async () => {
    const { container } = render(
      <KpiCard title="Upcoming events" value={42} icon={CalendarClock} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean with a dash placeholder", async () => {
    const { container } = render(
      <KpiCard title="Open invoices" value="—" icon={CalendarClock} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean as a link", async () => {
    const { container } = render(
      <KpiCard
        title="New requests"
        value={3}
        icon={CalendarClock}
        href="/bookings?status=new-requests"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
