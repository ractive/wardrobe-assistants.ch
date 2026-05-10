import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const createService = vi.hoisted(() => vi.fn());
const updateService = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../server/actions", () => ({ createService, updateService }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

import { ServiceForm } from "./ServiceForm";

afterEach(() => {
  cleanup();
  createService.mockReset();
  updateService.mockReset();
  refresh.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("ServiceForm — create mode", () => {
  it("happy path: fills the form and calls createService with parsed input", async () => {
    createService.mockResolvedValueOnce({
      error: false,
      message: "Service created.",
    });
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<ServiceForm mode="create" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Name"), "Sewing kit");
    await user.type(
      screen.getByLabelText("Description"),
      "Bring a portable sewing kit.",
    );
    await user.type(screen.getByLabelText(/Price \(CHF/), "25");
    await user.click(screen.getByRole("button", { name: "Create service" }));

    await waitFor(() => expect(createService).toHaveBeenCalledTimes(1));
    expect(createService.mock.calls[0]?.[0]).toEqual({
      name: "Sewing kit",
      description: "Bring a portable sewing kit.",
      priceType: "fixed",
      price: 25,
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Service created."),
    );
  });

  it("rejects negative price client-side", async () => {
    const user = userEvent.setup();
    render(<ServiceForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "x");
    await user.type(screen.getByLabelText("Description"), "y");
    await user.type(screen.getByLabelText(/Price \(CHF/), "-5");
    await user.click(screen.getByRole("button", { name: "Create service" }));

    expect(createService).not.toHaveBeenCalled();
  });

  it("rejects non-integer price client-side", async () => {
    const user = userEvent.setup();
    render(<ServiceForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "x");
    await user.type(screen.getByLabelText("Description"), "y");
    await user.type(screen.getByLabelText(/Price \(CHF/), "10.5");
    await user.click(screen.getByRole("button", { name: "Create service" }));

    expect(createService).not.toHaveBeenCalled();
  });

  it("renders a server-side error via the toast boundary", async () => {
    createService.mockResolvedValueOnce({
      error: true,
      message: "Could not create service.",
    });
    const user = userEvent.setup();
    render(<ServiceForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "Sewing kit");
    await user.type(screen.getByLabelText("Description"), "Bring a kit.");
    await user.type(screen.getByLabelText(/Price \(CHF/), "25");
    await user.click(screen.getByRole("button", { name: "Create service" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not create service."),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("disables the submit button while pending", async () => {
    let resolve: (v: { error: false; message: string }) => void = () => {};
    createService.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();
    render(<ServiceForm mode="create" />);

    await user.type(screen.getByLabelText("Name"), "Sewing kit");
    await user.type(screen.getByLabelText("Description"), "Bring a kit.");
    await user.type(screen.getByLabelText(/Price \(CHF/), "25");
    await user.click(screen.getByRole("button", { name: "Create service" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled(),
    );
    resolve({ error: false, message: "Service created." });
  });

  it("is axe-clean", async () => {
    const { container } = render(<ServiceForm mode="create" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ServiceForm — edit mode", () => {
  const defaults = {
    serviceId: "svc_1",
    name: "Sewing kit",
    description: "Bring a kit.",
    priceType: "hourly" as const,
    price: 80,
  };

  it("submits via updateService with the serviceId from props", async () => {
    updateService.mockResolvedValueOnce({
      error: false,
      message: "Service updated.",
    });
    const user = userEvent.setup();
    render(<ServiceForm mode="edit" defaults={defaults} />);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated kit");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateService).toHaveBeenCalledTimes(1));
    expect(updateService.mock.calls[0]?.[0]).toEqual({
      serviceId: "svc_1",
      name: "Updated kit",
      description: "Bring a kit.",
      priceType: "hourly",
      price: 80,
    });
  });
});
