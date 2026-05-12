import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../server/actions", () => ({
  archiveService: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import type { ServiceListItem } from "../schema";
import { ServicesTable } from "./ServicesTable";

afterEach(() => cleanup());

const sample: ServiceListItem[] = [
  {
    id: "s1",
    name: "Sewing kit",
    description: "Bring a portable sewing kit.",
    priceType: "fixed",
    price: 25,
    archived: false,
    createdAt: new Date(),
    priceFormatted: "CHF 25.-",
  },
  {
    id: "s2",
    name: "Hourly assistant",
    description: "On-site wardrobe support.",
    priceType: "hourly",
    price: 80,
    archived: true,
    createdAt: new Date(),
    priceFormatted: "CHF 80.-/h",
  },
];

describe("ServicesTable", () => {
  it("renders empty state when there are no services", () => {
    render(<ServicesTable services={[]} />);
    expect(screen.getByText(/No services yet/i)).toBeInTheDocument();
  });

  it("renders active and archived services with formatted prices", () => {
    render(<ServicesTable services={sample} />);
    // Price strings appear in both mobile + desktop layouts (4 cells total).
    expect(screen.getAllByText("CHF 25.-").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CHF 80.-/h").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fixed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hourly").length).toBeGreaterThan(0);
  });

  it("clicking a desktop table row opens the edit dialog", () => {
    const service = sample[0];
    if (!service) throw new Error("sample[0] is undefined");
    render(<ServicesTable services={[service]} />);
    // The ServiceTableRow renders a row with aria-label "Edit service <name>".
    const row = screen.getByRole("button", {
      name: /Edit service Sewing kit/i,
    });
    fireEvent.click(row);
    // The edit dialog title should now be visible.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Edit service")).toBeInTheDocument();
  });

  it("is axe-clean", async () => {
    // ServicesTable is rendered inside a <section> by the page, but the unit
    // test renders it bare — disable the landmark region rule which axe
    // applies at document level rather than to the component itself.
    const { container } = render(<ServicesTable services={sample} />);
    expect(
      await axe(container, {
        rules: {
          "aria-hidden-focus": { enabled: false },
          region: { enabled: false },
        },
      }),
    ).toHaveNoViolations();
  });
});
