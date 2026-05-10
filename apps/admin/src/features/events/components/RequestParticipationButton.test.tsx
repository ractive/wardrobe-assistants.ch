import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const mockRequestParticipation = vi.hoisted(() => vi.fn());
vi.mock("../server/actions", () => ({
  requestParticipation: mockRequestParticipation,
}));

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const mockToastError = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

// RTL's auto-cleanup does not fire without globals:true — call manually.
afterEach(() => {
  cleanup();
  mockRequestParticipation.mockReset();
  mockToastError.mockReset();
  mockToastSuccess.mockReset();
});

// Lazy import so mocks are set up first.
async function renderButton(eventId = "e1") {
  const { RequestParticipationButton } = await import(
    "./RequestParticipationButton"
  );
  return render(<RequestParticipationButton eventId={eventId} />);
}

describe("RequestParticipationButton", () => {
  it("renders the button with correct text", async () => {
    await renderButton();
    expect(
      screen.getByRole("button", { name: /request to participate/i }),
    ).toBeInTheDocument();
  });

  it("calls requestParticipation with the event id on click", async () => {
    mockRequestParticipation.mockResolvedValue({
      error: false,
      message: "Done.",
    });
    await renderButton("event-123");
    await userEvent.click(
      screen.getByRole("button", { name: /request to participate/i }),
    );
    expect(mockRequestParticipation).toHaveBeenCalledWith({
      eventId: "event-123",
    });
  });

  it("shows a success toast on successful request", async () => {
    mockRequestParticipation.mockResolvedValue({
      error: false,
      message: "Participation request sent.",
    });
    await renderButton();
    await userEvent.click(
      screen.getByRole("button", { name: /request to participate/i }),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Participation request sent.",
    );
  });

  it("shows an error toast when action returns error", async () => {
    mockRequestParticipation.mockResolvedValue({
      error: true,
      message: "Event not found.",
    });
    await renderButton();
    await userEvent.click(
      screen.getByRole("button", { name: /request to participate/i }),
    );
    expect(mockToastError).toHaveBeenCalledWith("Event not found.");
  });

  it("shows a fallback error toast when action throws", async () => {
    mockRequestParticipation.mockRejectedValue(new Error("network error"));
    await renderButton();
    await userEvent.click(
      screen.getByRole("button", { name: /request to participate/i }),
    );
    expect(mockToastError).toHaveBeenCalledWith(
      "Something went wrong. Please try again.",
    );
  });

  it("is axe-clean", async () => {
    const { container } = await renderButton();
    expect(await axe(container)).toHaveNoViolations();
  });
});
