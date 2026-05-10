import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const assignUser = vi.hoisted(() => vi.fn());
const unassignUser = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../server/actions", () => ({ assignUser, unassignUser }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

import { AssigneesPicker } from "./AssigneesPicker";

const candidates = [
  {
    id: "u1",
    email: "ada@example.com",
    displayName: "Ada Lovelace",
    role: "SQUAD_MEMBER" as const,
  },
  {
    id: "u2",
    email: "grace@example.com",
    displayName: "Grace Hopper",
    role: "SQUAD_MEMBER" as const,
  },
];

afterEach(() => {
  cleanup();
  assignUser.mockReset();
  unassignUser.mockReset();
  refresh.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("AssigneesPicker", () => {
  it("opens the picker, type-to-search filters, selecting calls assignUser", async () => {
    assignUser.mockResolvedValueOnce({
      error: false,
      message: "Ada assigned.",
    });
    const user = userEvent.setup();
    render(
      <AssigneesPicker
        eventId="evt_1"
        assignees={[]}
        candidates={candidates}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Assign user" }));

    // Type-to-search narrows the cmdk list. After typing "Ada" only Ada
    // should remain visible; Grace's name should disappear from the option list.
    const searchbox = await screen.findByPlaceholderText("Search users…");
    await user.type(searchbox, "Ada");

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Ada Lovelace");

    const firstOption = options[0];
    if (!firstOption) throw new Error("Expected at least one option");
    await user.click(firstOption);

    await waitFor(() =>
      expect(assignUser).toHaveBeenCalledWith({
        eventId: "evt_1",
        userId: "u1",
      }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Ada assigned."),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("hides already-assigned users from the candidate list", async () => {
    const user = userEvent.setup();
    render(
      <AssigneesPicker
        eventId="evt_1"
        assignees={[
          {
            userId: "u1",
            email: "ada@example.com",
            displayName: "Ada Lovelace",
            assignedAt: new Date(),
            status: "assigned" as const,
          },
        ]}
        candidates={candidates}
      />,
    );

    // Ada appears in the assignees row.
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Assign user" }));
    const list = await screen.findByRole("listbox");
    // Only Grace remains as a candidate.
    expect(within(list).getByText("Grace Hopper")).toBeInTheDocument();
    expect(within(list).queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("remove button fires unassignUser", async () => {
    unassignUser.mockResolvedValueOnce({
      error: false,
      message: "Ada unassigned.",
    });
    const user = userEvent.setup();
    render(
      <AssigneesPicker
        eventId="evt_1"
        assignees={[
          {
            userId: "u1",
            email: "ada@example.com",
            displayName: "Ada Lovelace",
            assignedAt: new Date(),
            status: "assigned" as const,
          },
        ]}
        candidates={candidates}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Unassign Ada Lovelace" }),
    );

    await waitFor(() =>
      expect(unassignUser).toHaveBeenCalledWith({
        eventId: "evt_1",
        userId: "u1",
      }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Ada unassigned."),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("disables the trigger when every candidate is assigned", () => {
    render(
      <AssigneesPicker
        eventId="evt_1"
        assignees={[
          {
            userId: "u1",
            email: "ada@example.com",
            displayName: "Ada Lovelace",
            assignedAt: new Date(),
            status: "assigned" as const,
          },
          {
            userId: "u2",
            email: "grace@example.com",
            displayName: "Grace Hopper",
            assignedAt: new Date(),
            status: "assigned" as const,
          },
        ]}
        candidates={candidates}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Everyone assigned" }),
    ).toBeDisabled();
  });

  it("is axe-clean in the closed state", async () => {
    const { container } = render(
      <AssigneesPicker
        eventId="evt_1"
        assignees={[
          {
            userId: "u1",
            email: "ada@example.com",
            displayName: "Ada Lovelace",
            assignedAt: new Date(),
            status: "assigned" as const,
          },
        ]}
        candidates={candidates}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
