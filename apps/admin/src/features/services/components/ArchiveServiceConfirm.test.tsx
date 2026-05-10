import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const archiveService = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../server/actions", () => ({ archiveService }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

import { ArchiveServiceConfirm } from "./ArchiveServiceConfirm";

afterEach(() => {
  cleanup();
  archiveService.mockReset();
  refresh.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("ArchiveServiceConfirm", () => {
  it("cancel closes the dialog without firing the action", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ArchiveServiceConfirm
        serviceId="s1"
        serviceName="Sewing kit"
        open
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(archiveService).not.toHaveBeenCalled();
  });

  it("confirm fires archiveService and refreshes on success", async () => {
    archiveService.mockResolvedValueOnce({
      error: false,
      message: "Service archived.",
    });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ArchiveServiceConfirm
        serviceId="s1"
        serviceName="Sewing kit"
        open
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Archive service" }));
    await waitFor(() =>
      expect(archiveService).toHaveBeenCalledWith({ serviceId: "s1" }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("renders an error live region when the action returns error: true", async () => {
    archiveService.mockResolvedValueOnce({
      error: true,
      message: "Could not archive service.",
    });
    const user = userEvent.setup();
    render(
      <ArchiveServiceConfirm
        serviceId="s1"
        serviceName="Sewing kit"
        open
        onOpenChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Archive service" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not archive service.",
      ),
    );
  });

  it("is axe-clean in the open + idle state", async () => {
    const { baseElement } = render(
      <ArchiveServiceConfirm
        serviceId="s1"
        serviceName="Sewing kit"
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
