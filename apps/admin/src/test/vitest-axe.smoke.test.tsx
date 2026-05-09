import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

describe("vitest-axe harness", () => {
  it("resolves and runs axe matchers", async () => {
    const { container } = render(
      <button type="button" aria-label="Save">
        Save
      </button>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
