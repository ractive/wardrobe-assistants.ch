import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const createBooking = vi.hoisted(() => vi.fn());
const updateBooking = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../server/actions", () => ({ createBooking, updateBooking }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

import { BookingForm } from "./BookingForm";

afterEach(() => {
  cleanup();
  createBooking.mockReset();
  updateBooking.mockReset();
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

// iter-37 §C.3: helper to fill the now-required When/Where fields on create.
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  // Start time — required for new bookings (iter-37 §C.3).
  await user.type(screen.getByPlaceholderText("e.g. 19:30"), "18:00");
  // Duration — required, min 5h (iter-37 §C.2+C.3).
  const durationInput = screen.getByRole("spinbutton");
  await user.clear(durationInput);
  await user.type(durationInput, "8");
  // City — required for new bookings (iter-37 §C.3).
  // The City label renders with a required asterisk; use getByLabelText which
  // strips trailing text, so we match on the exact accessible label.
  await user.type(screen.getByLabelText(/^City/), "Zurich");
}

describe("BookingForm — create mode", () => {
  it("happy path: fills the form, picks a date, calls createBooking with parsed input", async () => {
    createBooking.mockResolvedValueOnce({
      error: false,
      message: "Booking created.",
    });
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<BookingForm mode="create" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Name"), "Curtain Up");
    await user.type(screen.getByLabelText("Venue"), "Stadttheater");
    await pickFirstAvailableDate(user);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create booking" }));

    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1));
    const callArg = createBooking.mock.calls[0]?.[0];
    expect(callArg).toMatchObject({
      name: "Curtain Up",
      venue: "Stadttheater",
      startTime: "18:00",
      durationHours: 8,
      venueCity: "Zurich",
    });
    expect(callArg.date).toBeInstanceOf(Date);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Booking created."),
    );
  });

  it("renders a server-side error via the toast boundary", async () => {
    createBooking.mockResolvedValueOnce({
      error: true,
      message: "Could not create booking.",
    });
    const user = userEvent.setup();
    render(<BookingForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "Curtain Up");
    await user.type(screen.getByLabelText("Venue"), "Stadttheater");
    await pickFirstAvailableDate(user);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create booking" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not create booking."),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("is axe-clean", async () => {
    const { container } = render(<BookingForm mode="create" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("BookingForm — edit mode", () => {
  const defaults = {
    bookingId: "bk_1",
    name: "Curtain Up",
    date: new Date("2026-06-15T00:00:00Z"),
    venue: "Stadttheater",
    notes: null,
  };

  it("submits via updateBooking with the bookingId from props", async () => {
    updateBooking.mockResolvedValueOnce({
      error: false,
      message: "Booking updated.",
    });
    const user = userEvent.setup();
    render(<BookingForm mode="edit" defaults={defaults} />);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Curtain Down");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateBooking).toHaveBeenCalledTimes(1));
    expect(updateBooking.mock.calls[0]?.[0]).toMatchObject({
      bookingId: "bk_1",
      name: "Curtain Down",
      venue: "Stadttheater",
    });
  });
});
