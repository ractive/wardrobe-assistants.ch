import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

// Vitest is not running with `globals: true`, so RTL's auto-cleanup hook
// doesn't fire. Without explicit cleanup, Radix Dialog portals from earlier
// tests stack onto document.body and the axe(baseElement) check trips on
// stale aria-hidden dialogs.
afterEach(() => {
  cleanup();
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
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Deleted."));
    expect(refresh).toHaveBeenCalledTimes(1);
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
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("is axe-clean in the open + idle state", async () => {
    // DialogContent renders through a Radix portal under document.body, so
    // axe(container) misses the dialog markup. baseElement walks the full
    // tree including portals. We disable `aria-hidden-focus` because Radix's
    // focus-trap guards are aria-hidden+tabindex=0 by design — axe flags them
    // but the pattern is intentional and accepted upstream.
    const { baseElement } = render(
      <DeleteEventConfirm
        eventId="evt_1"
        eventName="Curtain Up"
        open
        onOpenChange={() => {}}
      />,
    );
    expect(
      await axe(baseElement, {
        rules: { "aria-hidden-focus": { enabled: false } },
      }),
    ).toHaveNoViolations();
  });
});
