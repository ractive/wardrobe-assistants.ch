// a11y smoke test for IcsDownloadButton — uses vitest-axe per the design-system/a11y.md baseline.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { IcsDownloadButton } from "./IcsDownloadButton";

describe("IcsDownloadButton a11y", () => {
  it("renders without axe violations", async () => {
    const { container } = render(
      <IcsDownloadButton bookingId="booking-abc-123" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
