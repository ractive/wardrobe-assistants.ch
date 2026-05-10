import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { PendingRequest } from "../schema";

const mockApproveRequest = vi.hoisted(() => vi.fn());
const mockRejectRequest = vi.hoisted(() => vi.fn());
vi.mock("../server/actions", () => ({
  approveRequest: mockApproveRequest,
  rejectRequest: mockRejectRequest,
}));

const mockToastError = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  mockApproveRequest.mockReset();
  mockRejectRequest.mockReset();
  mockToastError.mockReset();
  mockToastSuccess.mockReset();
});

const request: PendingRequest = {
  userId: "u1",
  displayName: "Jane Doe",
  email: "jane@example.com",
  requestedAt: new Date("2026-05-01"),
};

async function renderPanel(
  eventId = "e1",
  requests: PendingRequest[] = [request],
) {
  const { PendingRequestsPanel } = await import("./PendingRequestsPanel");
  return render(
    <PendingRequestsPanel eventId={eventId} pendingRequests={requests} />,
  );
}

describe("PendingRequestsPanel", () => {
  it("renders nothing when there are no pending requests", async () => {
    const { container } = await renderPanel("e1", []);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders pending request with name and email", async () => {
    await renderPanel();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("calls approveRequest on Approve click", async () => {
    mockApproveRequest.mockResolvedValue({
      error: false,
      message: "Request approved.",
    });
    await renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: /approve jane doe/i }),
    );
    expect(mockApproveRequest).toHaveBeenCalledWith({
      eventId: "e1",
      userId: "u1",
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Request approved.");
  });

  it("calls rejectRequest on Reject click", async () => {
    mockRejectRequest.mockResolvedValue({
      error: false,
      message: "Request rejected.",
    });
    await renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: /reject jane doe/i }),
    );
    expect(mockRejectRequest).toHaveBeenCalledWith({
      eventId: "e1",
      userId: "u1",
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Request rejected.");
  });

  it("shows error toast when approve fails", async () => {
    mockApproveRequest.mockResolvedValue({
      error: true,
      message: "No pending request found.",
    });
    await renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: /approve jane doe/i }),
    );
    expect(mockToastError).toHaveBeenCalledWith("No pending request found.");
  });

  it("shows fallback error when approve throws", async () => {
    mockApproveRequest.mockRejectedValue(new Error("network"));
    await renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: /approve jane doe/i }),
    );
    expect(mockToastError).toHaveBeenCalledWith(
      "Something went wrong. Please try again.",
    );
  });

  it("is axe-clean", async () => {
    const { container } = await renderPanel();
    expect(await axe(container)).toHaveNoViolations();
  });
});
