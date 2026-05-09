import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ThemeToggle } from "./ThemeToggle";

// Mock next-themes so we can inspect setTheme calls without a real ThemeProvider.
const mockSetTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: mockSetTheme }),
}));

afterEach(() => {
  cleanup();
  mockSetTheme.mockClear();
});

describe("ThemeToggle", () => {
  it("renders a toggle button with sr-only label", () => {
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /toggle theme/i }),
    ).toBeInTheDocument();
  });

  it("opens a menu with Light, Dark, and System options", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(screen.getByRole("menuitem", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Dark" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "System" }),
    ).toBeInTheDocument();
  });

  it("calls setTheme('light') when Light is clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    await user.click(screen.getByRole("menuitem", { name: "Light" }));

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls setTheme('dark') when Dark is clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    await user.click(screen.getByRole("menuitem", { name: "Dark" }));

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme('system') when System is clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    await user.click(screen.getByRole("menuitem", { name: "System" }));

    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });

  it("is axe-clean", async () => {
    const { container } = render(<ThemeToggle />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
