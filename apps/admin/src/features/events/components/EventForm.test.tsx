import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const createEvent = vi.hoisted(() => vi.fn());
const updateEvent = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../server/actions", () => ({ createEvent, updateEvent }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

import { EventForm } from "./EventForm";

afterEach(() => {
  cleanup();
  createEvent.mockReset();
  updateEvent.mockReset();
  refresh.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

// Helper: open the date popover and click the first available calendar day.
async function pickFirstAvailableDate(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByText("Pick a date"));
  // Calendar's day buttons are rendered with role="gridcell" wrapping a button.
  const dayButtons = await screen.findAllByRole("gridcell");
  // Find the first non-disabled day button inside the gridcells.
  for (const cell of dayButtons) {
    const btn = cell.querySelector("button");
    if (btn && !btn.hasAttribute("disabled")) {
      await user.click(btn);
      return;
    }
  }
  throw new Error("No selectable day found in calendar");
}

describe("EventForm — create mode", () => {
  it("happy path: fills the form, picks a date, calls createEvent with parsed input", async () => {
    createEvent.mockResolvedValueOnce({
      error: false,
      message: "Event created.",
    });
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<EventForm mode="create" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Name"), "Curtain Up");
    await user.type(screen.getByLabelText("Venue"), "Stadttheater");
    await pickFirstAvailableDate(user);
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
    const callArg = createEvent.mock.calls[0]?.[0];
    expect(callArg).toMatchObject({
      name: "Curtain Up",
      venue: "Stadttheater",
      status: "draft",
    });
    expect(callArg.date).toBeInstanceOf(Date);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Event created."),
    );
  });

  it("renders a server-side error via the toast boundary", async () => {
    createEvent.mockResolvedValueOnce({
      error: true,
      message: "Could not create event.",
    });
    const user = userEvent.setup();
    render(<EventForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "Curtain Up");
    await user.type(screen.getByLabelText("Venue"), "Stadttheater");
    await pickFirstAvailableDate(user);
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not create event."),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("is axe-clean", async () => {
    const { container } = render(<EventForm mode="create" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("EventForm — edit mode", () => {
  const defaults = {
    eventId: "evt_1",
    name: "Curtain Up",
    date: new Date("2026-06-15T00:00:00Z"),
    venue: "Stadttheater",
    notes: null,
    status: "published" as const,
  };

  it("submits via updateEvent with the eventId from props", async () => {
    updateEvent.mockResolvedValueOnce({
      error: false,
      message: "Event updated.",
    });
    const user = userEvent.setup();
    render(<EventForm mode="edit" defaults={defaults} />);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Curtain Down");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
    expect(updateEvent.mock.calls[0]?.[0]).toMatchObject({
      eventId: "evt_1",
      name: "Curtain Down",
      venue: "Stadttheater",
      status: "published",
    });
  });
});
