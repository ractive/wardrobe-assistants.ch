import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { PageHeader } from "./PageHeader";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders the title", () => {
    render(<PageHeader title="Overview" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
  });

  it("renders an optional description", () => {
    render(<PageHeader title="Overview" description="Welcome back, James" />);
    expect(screen.getByText("Welcome back, James")).toBeInTheDocument();
  });

  it("does not render a description element when omitted", () => {
    const { container } = render(<PageHeader title="Overview" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders optional actions", () => {
    render(
      <PageHeader
        title="Overview"
        actions={<button type="button">New event</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "New event" }),
    ).toBeInTheDocument();
  });

  it("does not render an actions slot when omitted", () => {
    const { container } = render(<PageHeader title="Overview" />);
    // When no actions, the actions div should not be present
    const header = container.querySelector("header");
    expect(header?.children.length).toBe(1);
  });

  it("is axe-clean with title only", async () => {
    const { container } = render(<PageHeader title="Overview" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean with title + description + actions", async () => {
    const { container } = render(
      <PageHeader
        title="Overview"
        description="Welcome back"
        actions={<button type="button">Add</button>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
