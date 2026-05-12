import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import SegmentError from "./SegmentError";

describe("SegmentError a11y", () => {
  it("renders without axe violations", async () => {
    const { container } = render(
      <SegmentError error={new Error("test error")} reset={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders with generic message when error.message is empty", async () => {
    const emptyError = new Error("");
    const { container } = render(
      <SegmentError error={emptyError} reset={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
