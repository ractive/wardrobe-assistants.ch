import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// Mock sonner so toast calls don't error in jsdom.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";
import { OfferUrlActions } from "./OfferUrlActions";

afterEach(() => cleanup());

const BASE_URL = "https://admin.wardrobe-assistants.ch";
const TOKEN = "test-token-abc123";

describe("OfferUrlActions", () => {
  it("renders Copy offer link button and View as customer link", () => {
    const { container } = render(
      <OfferUrlActions offerToken={TOKEN} baseUrl={BASE_URL} />,
    );
    expect(
      within(container).getByRole("button", { name: /copy offer link/i }),
    ).toBeInTheDocument();
    expect(
      within(container).getByRole("link", { name: /view offer as customer/i }),
    ).toBeInTheDocument();
  });

  it("View as customer link points to the correct offer URL", () => {
    const { container } = render(
      <OfferUrlActions offerToken={TOKEN} baseUrl={BASE_URL} />,
    );
    const link = within(container).getByRole("link", {
      name: /view offer as customer/i,
    });
    expect(link).toHaveAttribute("href", `${BASE_URL}/offer/${TOKEN}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("copies the correct URL on click and shows a success toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { container } = render(
      <OfferUrlActions offerToken={TOKEN} baseUrl={BASE_URL} />,
    );
    fireEvent.click(
      within(container).getByRole("button", { name: /copy offer link/i }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${BASE_URL}/offer/${TOKEN}`);
      expect(toast.success).toHaveBeenCalledWith(
        "Offer link copied to clipboard.",
      );
    });
  });

  it("shows an error toast when clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { container } = render(
      <OfferUrlActions offerToken={TOKEN} baseUrl={BASE_URL} />,
    );
    fireEvent.click(
      within(container).getByRole("button", { name: /copy offer link/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Couldn't copy"),
      );
    });
  });

  it("is axe-clean", async () => {
    const { container } = render(
      <OfferUrlActions offerToken={TOKEN} baseUrl={BASE_URL} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
