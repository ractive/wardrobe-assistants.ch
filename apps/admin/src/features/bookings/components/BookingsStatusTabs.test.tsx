import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// BookingsStatusTabs uses useRouter — mock next/navigation.
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/bookings"),
}));

import { BookingsStatusTabs } from "./BookingsStatusTabs";

afterEach(() => cleanup());

describe("BookingsStatusTabs", () => {
  it("renders the five tab options", () => {
    const { container } = render(
      <BookingsStatusTabs activeFilter="all" newRequestsCount={0} />,
    );
    // Desktop nav renders links; mobile renders a Select.
    // Check desktop nav (the nav element) for the tab labels.
    expect(within(container).getAllByText("All").length).toBeGreaterThan(0);
    expect(
      within(container).getAllByText(/New requests/i).length,
    ).toBeGreaterThan(0);
    expect(within(container).getAllByText("Offered").length).toBeGreaterThan(0);
    expect(within(container).getAllByText("Accepted").length).toBeGreaterThan(
      0,
    );
    expect(within(container).getAllByText("Cancelled").length).toBeGreaterThan(
      0,
    );
  });

  it("shows a badge on New requests when count > 0", () => {
    const { container } = render(
      <BookingsStatusTabs activeFilter="all" newRequestsCount={4} />,
    );
    expect(
      within(container).getByLabelText("4 new requests"),
    ).toBeInTheDocument();
  });

  it("does not show a badge when newRequestsCount is 0", () => {
    const { container } = render(
      <BookingsStatusTabs activeFilter="all" newRequestsCount={0} />,
    );
    expect(within(container).queryByLabelText(/new request/i)).toBeNull();
  });

  it("marks the active tab with aria-current=page", () => {
    const { container } = render(
      <BookingsStatusTabs activeFilter="offered" newRequestsCount={0} />,
    );
    const currentLinks = within(container)
      .getAllByRole("link")
      .filter((el) => el.getAttribute("aria-current") === "page");
    // The "Offered" link should be the only aria-current one.
    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]).toHaveTextContent("Offered");
  });

  it("is axe-clean with no requests", async () => {
    const { container } = render(
      <BookingsStatusTabs activeFilter="all" newRequestsCount={0} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean with pending requests", async () => {
    const { container } = render(
      <BookingsStatusTabs activeFilter="new-requests" newRequestsCount={2} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
