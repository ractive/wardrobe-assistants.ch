import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { InfoHint } from "./InfoHint";

// Vitest does not auto-cleanup; Radix portals would pile up on document.body.
afterEach(cleanup);

function renderHint() {
  return render(<InfoHint label="Info: Example">Example hint text</InfoHint>);
}

describe("InfoHint", () => {
  it("is closed initially", () => {
    renderHint();
    expect(screen.queryByText("Example hint text")).toBeNull();
  });

  it("opens on mouse hover and closes when the mouse leaves", async () => {
    const user = userEvent.setup();
    renderHint();
    const trigger = screen.getByRole("button", { name: "Info: Example" });
    await user.hover(trigger);
    expect(await screen.findByText("Example hint text")).toBeInTheDocument();
    await user.unhover(trigger);
    expect(screen.queryByText("Example hint text")).toBeNull();
  });

  it("opens on click (tap) and stays open after the pointer leaves", async () => {
    const user = userEvent.setup();
    renderHint();
    const trigger = screen.getByRole("button", { name: "Info: Example" });
    // user.click hovers first, so this also covers "click while hover-open
    // pins instead of closing".
    await user.click(trigger);
    await user.unhover(trigger);
    expect(screen.getByText("Example hint text")).toBeInTheDocument();
    // A second click unpins and closes.
    await user.click(trigger);
    expect(screen.queryByText("Example hint text")).toBeNull();
  });

  it("toggles with the keyboard and closes on Escape", async () => {
    const user = userEvent.setup();
    renderHint();
    await user.tab();
    expect(screen.getByRole("button", { name: "Info: Example" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Example hint text")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Example hint text")).toBeNull();
  });

  it("is axe-clean when open", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderHint();
    await user.click(screen.getByRole("button", { name: "Info: Example" }));
    await screen.findByText("Example hint text");
    expect(
      await axe(baseElement, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
