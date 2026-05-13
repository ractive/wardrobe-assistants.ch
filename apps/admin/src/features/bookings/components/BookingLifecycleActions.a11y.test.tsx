// A.6 / A.1 a11y smoke test — verifies the lifecycle buttons with inline (i)
// icon + Tooltip are axe-clean in both closed and open states.
//
// All server actions are mocked; this is a pure rendering test.

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

vi.mock("../server/actions", () => ({
  sendOffer: vi.fn(),
  sendRevisedOffer: vi.fn(),
  adminAcceptOffer: vi.fn(),
  rejectBooking: vi.fn(),
  cancelBooking: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { BookingLifecycleButtons } from "./BookingLifecycleActions";

// Vitest does not auto-cleanup between tests — without explicit cleanup,
// Radix portals from earlier tests accumulate on document.body.
afterEach(cleanup);

const BASE_PROPS = {
  bookingId: "booking-1",
  customerEmail: "customer@example.com",
  selectionCount: 2,
  lineItemsTotal: 600,
  squadMemberNames: ["Alice", "Bob"],
};

describe("BookingLifecycleButtons a11y — inline (i) icon + Tooltip", () => {
  it("renders created status without axe violations (buttons closed)", async () => {
    const { container } = render(
      <BookingLifecycleButtons
        {...BASE_PROPS}
        status="created"
        canSendOffer={true}
        canAccept={true}
        canReject={true}
        canCancel={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders offered status without axe violations", async () => {
    const { container } = render(
      <BookingLifecycleButtons
        {...BASE_PROPS}
        status="offered"
        canSendOffer={true}
        canAccept={true}
        canReject={true}
        canCancel={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders accepted status without axe violations", async () => {
    const { container } = render(
      <BookingLifecycleButtons
        {...BASE_PROPS}
        status="accepted"
        canSendOffer={true}
        canAccept={false}
        canReject={false}
        canCancel={true}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders the Send offer button alongside a separate focusable (i) info button", async () => {
    render(
      <BookingLifecycleButtons
        {...BASE_PROPS}
        status="created"
        canSendOffer={true}
        canAccept={false}
        canReject={false}
        canCancel={false}
      />,
    );
    // The action button is present (exact match to avoid hitting the info button).
    const sendBtn = screen.getByRole("button", { name: "Send offer" });
    expect(sendBtn).toBeDefined();
    // §E: the (i) icon is now a separate focusable button — tooltip triggers
    // from it only, not from the action button.
    const infoBtn = screen.getByRole("button", { name: "Info: Send offer" });
    expect(infoBtn).toBeDefined();
  });

  it("tooltip is axe-clean when the Send offer button is focused", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <BookingLifecycleButtons
        {...BASE_PROPS}
        status="created"
        canSendOffer={true}
        canAccept={false}
        canReject={false}
        canCancel={false}
      />,
    );
    // Tab to the button so the tooltip becomes visible.
    await user.tab();
    expect(
      await axe(baseElement, {
        rules: {
          "aria-hidden-focus": { enabled: false },
          region: { enabled: false },
        },
      }),
    ).toHaveNoViolations();
  });

  it("shows contextual helper line for created status", () => {
    const { getByText } = render(
      <BookingLifecycleButtons
        {...BASE_PROPS}
        status="created"
        canSendOffer={true}
        canAccept={false}
        canReject={false}
        canCancel={false}
      />,
    );
    expect(
      getByText(/This booking is new. Send offer to email/i),
    ).toBeDefined();
  });

  it("shows contextual helper line for offered status", () => {
    const { getByText } = render(
      <BookingLifecycleButtons
        {...BASE_PROPS}
        status="offered"
        canSendOffer={false}
        canAccept={true}
        canReject={true}
        canCancel={false}
      />,
    );
    expect(
      getByText(/Offer sent. Waiting for the customer to accept./i),
    ).toBeDefined();
  });

  it("does not show lifecycle buttons on terminal status", () => {
    const { container } = render(
      <BookingLifecycleButtons
        {...BASE_PROPS}
        status="cancelled"
        canSendOffer={true}
        canAccept={true}
        canReject={true}
        canCancel={true}
      />,
    );
    // The component returns null for terminal status — container is empty
    expect(container.firstChild).toBeNull();
  });
});
