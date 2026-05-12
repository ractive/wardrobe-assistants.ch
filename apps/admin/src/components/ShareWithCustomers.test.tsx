import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// Mock sonner so toasts don't require a real Toaster in the DOM.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ShareWithCustomers } from "./ShareWithCustomers";

const TEST_URL = "https://wardrobe-assistants.ch/booking-request";

// Spy on happy-dom's built-in navigator.clipboard.writeText.
// happy-dom ships its own Clipboard implementation, so stub/defineProperty
// on navigator.clipboard doesn't intercept calls — vi.spyOn on the existing
// method does. Use fireEvent for the click (userEvent.setup() uses pointer
// event sequencing that skips async handlers in happy-dom).
let writeTextSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  writeTextSpy = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue(undefined);
});

afterEach(() => {
  writeTextSpy.mockRestore();
  cleanup();
  vi.clearAllMocks();
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
    render(<ShareWithCustomers bookingRequestUrl={TEST_URL} />);

    fireEvent.click(
      screen.getByRole("button", { name: /copy booking-request url/i }),
    );

    await waitFor(() => expect(writeTextSpy).toHaveBeenCalledWith(TEST_URL));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /copied/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows error toast when clipboard write fails", async () => {
    const { toast } = await import("sonner");
    writeTextSpy.mockRejectedValueOnce(new Error("Not allowed"));

    render(<ShareWithCustomers bookingRequestUrl={TEST_URL} />);

    fireEvent.click(
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
