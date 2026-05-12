import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// Mock sonner so toasts don't require a real Toaster in the DOM.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ShareWithCustomers } from "./ShareWithCustomers";

const TEST_URL = "https://wardrobe-assistants.ch/booking-request";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ShareWithCustomers", () => {
  it("renders the booking-request URL", () => {
    render(<ShareWithCustomers bookingRequestUrl={TEST_URL} />);
    expect(screen.getByText(TEST_URL)).toBeInTheDocument();
  });

  it("renders a Copy link button", () => {
    render(<ShareWithCustomers bookingRequestUrl={TEST_URL} />);
    expect(
      screen.getByRole("button", { name: /copy booking-request url/i }),
    ).toBeInTheDocument();
  });

  it("copies the URL to the clipboard and shows Copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const user = userEvent.setup();
    render(<ShareWithCustomers bookingRequestUrl={TEST_URL} />);

    await user.click(
      screen.getByRole("button", { name: /copy booking-request url/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /copied/i }),
      ).toBeInTheDocument(),
    );
    expect(writeText).toHaveBeenCalledWith(TEST_URL);
  });

  it("shows error toast when clipboard write fails", async () => {
    const { toast } = await import("sonner");
    const writeText = vi.fn().mockRejectedValue(new Error("Not allowed"));
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const user = userEvent.setup();
    render(<ShareWithCustomers bookingRequestUrl={TEST_URL} />);

    await user.click(
      screen.getByRole("button", { name: /copy booking-request url/i }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not copy to clipboard"),
    );
  });

  it("is axe-clean", async () => {
    const { container } = render(
      <ShareWithCustomers bookingRequestUrl={TEST_URL} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
