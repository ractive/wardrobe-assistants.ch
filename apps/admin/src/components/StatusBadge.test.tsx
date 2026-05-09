import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  describe("kind=event", () => {
    const cases = [
      { status: "draft" as const, label: "Draft" },
      { status: "published" as const, label: "Published" },
      { status: "cancelled" as const, label: "Cancelled" },
      { status: "done" as const, label: "Done" },
    ];

    for (const { status, label } of cases) {
      it(`renders the ${status} badge with the right label`, () => {
        const { getByText } = render(
          <StatusBadge kind="event" status={status} />,
        );
        expect(getByText(label)).toBeInTheDocument();
      });
    }
  });

  describe("kind=user", () => {
    const cases = [
      { status: "invited" as const, label: "Invited" },
      { status: "verified" as const, label: "Verified" },
    ];

    for (const { status, label } of cases) {
      it(`renders the ${status} badge with the right label`, () => {
        const { getByText } = render(
          <StatusBadge kind="user" status={status} />,
        );
        expect(getByText(label)).toBeInTheDocument();
      });
    }
  });

  it("is axe-clean", async () => {
    const { container } = render(
      <div>
        <StatusBadge kind="event" status="draft" />
        <StatusBadge kind="event" status="published" />
        <StatusBadge kind="event" status="cancelled" />
        <StatusBadge kind="event" status="done" />
        <StatusBadge kind="user" status="invited" />
        <StatusBadge kind="user" status="verified" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
