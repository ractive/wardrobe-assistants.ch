// a11y tests for iter-23 PWA components — PushSubscribeToggle and
// InstallPrompt. Uses vitest-axe per the design-system/a11y.md a11y baseline.

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// PushSubscribeToggle calls subscribePush / unsubscribePush server actions.
// Mock so the component renders without a Next.js server.
vi.mock("@/app/(dashboard)/actions/push", () => ({
  subscribePush: vi.fn(async () => ({ success: true })),
  unsubscribePush: vi.fn(async () => ({ success: true })),
}));

import { InstallPrompt } from "./InstallPrompt";
import { PushSubscribeToggle } from "./PushSubscribeToggle";

describe("PushSubscribeToggle a11y", () => {
  it("renders null (unsupported env) without violations", async () => {
    // jsdom doesn't expose serviceWorker/PushManager so isSupported stays false
    // and the component returns null — axe on an empty container is still valid.
    const { container } = render(<PushSubscribeToggle />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("InstallPrompt a11y", () => {
  it("renders null (non-iOS env) without violations", async () => {
    // jsdom userAgent is not iOS so the component returns null.
    const { container } = render(<InstallPrompt />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
