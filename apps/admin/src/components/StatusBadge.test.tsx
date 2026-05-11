import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import { axe } from "vitest-axe";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  describe("kind=booking", () => {
    const cases = [
      { status: "created" as const, label: "Created" },
      { status: "offered" as const, label: "Offered" },
      { status: "accepted" as const, label: "Accepted" },
      { status: "rejected" as const, label: "Rejected" },
      { status: "cancelled" as const, label: "Cancelled" },
    ];

    for (const { status, label } of cases) {
      it(`renders the ${status} badge with the right label`, () => {
        const { getByText } = render(
          <StatusBadge kind="booking" status={status} />,
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

  describe("kind=assignment", () => {
    const cases = [
      { status: "assigned" as const, label: "Assigned" },
      { status: "requested" as const, label: "Requested" },
      { status: "confirmed" as const, label: "Confirmed" },
      { status: "rejected" as const, label: "Rejected" },
      { status: "withdrawn" as const, label: "Withdrawn" },
    ];

    for (const { status, label } of cases) {
      it(`renders the ${status} badge with the right label`, () => {
        const { getByText } = render(
          <StatusBadge kind="assignment" status={status} />,
        );
        expect(getByText(label)).toBeInTheDocument();
      });
    }
  });

  it("is axe-clean", async () => {
    const { container } = render(
      <div>
        <StatusBadge kind="booking" status="created" />
        <StatusBadge kind="booking" status="offered" />
        <StatusBadge kind="booking" status="accepted" />
        <StatusBadge kind="booking" status="rejected" />
        <StatusBadge kind="booking" status="cancelled" />
        <StatusBadge kind="user" status="invited" />
        <StatusBadge kind="user" status="verified" />
        <StatusBadge kind="assignment" status="assigned" />
        <StatusBadge kind="assignment" status="requested" />
        <StatusBadge kind="assignment" status="confirmed" />
        <StatusBadge kind="assignment" status="rejected" />
        <StatusBadge kind="assignment" status="withdrawn" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
