import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const deleteEvent = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../server/actions", () => ({ deleteEvent }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

import { DeleteEventConfirm } from "./DeleteEventConfirm";

afterEach(() => {
  deleteEvent.mockReset();
  refresh.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("DeleteEventConfirm", () => {
  it("cancel closes the dialog without firing the action", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <DeleteEventConfirm
        eventId="evt_1"
        eventName="Curtain Up"
        open
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("confirm fires the action and closes on success", async () => {
    deleteEvent.mockResolvedValueOnce({ error: false, message: "Deleted." });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <DeleteEventConfirm
        eventId="evt_1"
        eventName="Curtain Up"
        open
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete event" }));
    await waitFor(() =>
      expect(deleteEvent).toHaveBeenCalledWith({
        eventId: "evt_1",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith("Deleted.");
  });

  it("renders an error live region when the action returns error: true", async () => {
    deleteEvent.mockResolvedValueOnce({
      error: true,
      message: "Could not delete event.",
    });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <DeleteEventConfirm
        eventId="evt_1"
        eventName="Curtain Up"
        open
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete event" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not delete event.",
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("blocks closing while pending — the destructive cannot-cancel-mid-deletion pattern", async () => {
    let resolve: (v: { error: false; message: string }) => void = () => {};
    deleteEvent.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <DeleteEventConfirm
        eventId="evt_1"
        eventName="Curtain Up"
        open
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete event" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    resolve({ error: false, message: "Deleted." });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("is axe-clean in the open + idle state", async () => {
    const { container } = render(
      <DeleteEventConfirm
        eventId="evt_1"
        eventName="Curtain Up"
        open
        onOpenChange={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
