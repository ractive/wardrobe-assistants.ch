import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { BrandBadge } from "./BrandBadge";

afterEach(cleanup);

describe("BrandBadge", () => {
  it("renders a link pointing to /", () => {
    render(<BrandBadge />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/");
  });

  it("icon has aria-hidden", () => {
    const { container } = render(<BrandBadge />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is axe-clean", async () => {
    const { container } = render(<BrandBadge />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
