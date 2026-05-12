// a11y smoke test for UserMenu — uses vitest-axe per the design-system/a11y.md baseline.
// UserMenu calls useSidebar, so it must be wrapped in SidebarProvider.

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { SidebarProvider } from "@/components/ui/sidebar";

// Mock next/navigation — UserMenu calls useRouter for post-sign-out redirect.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// Mock auth-client so sign-out never fires a real network call.
vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

// Mock next-themes — UserMenu calls useTheme for the theme sub-menu (D.1).
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: "system" }),
}));

import { UserMenu } from "./UserMenu";

describe("UserMenu a11y", () => {
  it("renders without axe violations", async () => {
    const { container } = render(
      <SidebarProvider>
        <UserMenu email="test@example.com" />
      </SidebarProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
