import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { InfoHint } from "./InfoHint";

// Vitest does not auto-cleanup; Radix portals would pile up on document.body.
afterEach(cleanup);

function renderHint() {
  return render(
    <>
      <input aria-label="Other field" />
      <InfoHint label="Info: Example">Example hint text</InfoHint>
    </>,
  );
}

const trigger = () => screen.getByRole("button", { name: "Info: Example" });
// The text is also in a visually hidden description; the popover is the dialog.
const hint = () => screen.queryByRole("dialog", { name: "Info: Example" });

describe("InfoHint", () => {
  it("is closed initially", () => {
    renderHint();
    expect(hint()).toBeNull();
  });

  it("describes the icon button with the hint text, open or not", () => {
    renderHint();
    expect(trigger()).toHaveAccessibleDescription("Example hint text");
  });

  it("opens on mouse hover and closes after the mouse leaves", async () => {
    const user = userEvent.setup();
    renderHint();
    await user.hover(trigger());
    expect(hint()).toHaveTextContent("Example hint text");
    await user.unhover(trigger());
    await waitFor(() => expect(hint()).toBeNull());
  });

  it("stays open while the mouse moves from the icon onto the hint", async () => {
    const user = userEvent.setup();
    renderHint();
    await user.hover(trigger());
    const content = hint();
    expect(content).not.toBeNull();
    await user.hover(content as HTMLElement);
    // Longer than the close delay: the hover on the hint cancelled it.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(hint()).not.toBeNull();
    await user.unhover(content as HTMLElement);
    await waitFor(() => expect(hint()).toBeNull());
  });

  it("does not take focus from another element on hover open and close", async () => {
    const user = userEvent.setup();
    renderHint();
    const input = screen.getByRole("textbox", { name: "Other field" });
    input.focus();
    await user.hover(trigger());
    await user.unhover(trigger());
    await waitFor(() => expect(hint()).toBeNull());
    // Radix refocuses on unmount in a timeout; give it the chance.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(input).toHaveFocus();
  });

  it("opens on click (tap) and stays open after the pointer leaves", async () => {
    const user = userEvent.setup();
    renderHint();
    // user.click hovers first, so this also covers "click while hover-open
    // pins instead of closing".
    await user.click(trigger());
    await user.unhover(trigger());
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(hint()).not.toBeNull();
    // A second click unpins and closes.
    await user.click(trigger());
    expect(hint()).toBeNull();
  });

  it("toggles with the keyboard and closes on Escape", async () => {
    const user = userEvent.setup();
    renderHint();
    await user.tab();
    await user.tab();
    expect(trigger()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(hint()).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(hint()).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("is axe-clean when open", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderHint();
    await user.click(trigger());
    expect(hint()).not.toBeNull();
    expect(
      await axe(baseElement, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
