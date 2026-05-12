// a11y smoke test for NoPermissionCard — uses vitest-axe per the design-system.md baseline.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { NoPermissionCard } from "./NoPermissionCard";

describe("NoPermissionCard a11y", () => {
  it("renders with default message without axe violations", async () => {
    const { container } = render(<NoPermissionCard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders with custom message without axe violations", async () => {
    const { container } = render(
      <NoPermissionCard message="You do not have access to this section." />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
