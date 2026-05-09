import { cleanup, render, screen } from "@testing-library/react";
import { Calendar, Users } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar, NavLink } from "./DashboardSidebar";

// Mock next/navigation — pathname controls active-link state.
const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ replace: vi.fn() }),
}));

// Mock next-themes so ThemeToggle renders without a real ThemeProvider.
const mockSetTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: mockSetTheme, theme: "system" }),
}));

// Mock auth-client so UserMenu sign-out never actually fires.
vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

function renderSidebar(pathname = "/", children?: React.ReactNode) {
  mockPathname.mockReturnValue(pathname);
  return render(
    <SidebarProvider>
      <DashboardSidebar userEmail="test@example.com">
        {children}
      </DashboardSidebar>
    </SidebarProvider>,
  );
}

afterEach(() => {
  cleanup();
  mockSetTheme.mockClear();
  mockPathname.mockReset();
});

describe("DashboardSidebar", () => {
  it("renders the Home link", () => {
    renderSidebar("/");
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
  });

  it("Home link is active (aria-current=page) when pathname is /", () => {
    renderSidebar("/");
    const link = screen.getByRole("link", { name: /home/i });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("Home link is not active when pathname is /users", () => {
    renderSidebar("/users");
    const link = screen.getByRole("link", { name: /home/i });
    expect(link).not.toHaveAttribute("aria-current", "page");
  });

  it("child NavLink is active when pathname matches exactly", () => {
    renderSidebar(
      "/users",
      <NavLink href="/users" label="Users" icon={Users} />,
    );
    const link = screen.getByRole("link", { name: /users/i });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("child NavLink is active when pathname starts with the href", () => {
    renderSidebar(
      "/events/123",
      <NavLink href="/events" label="Events" icon={Calendar} />,
    );
    const link = screen.getByRole("link", { name: /events/i });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("child NavLink is not active when pathname does not match", () => {
    renderSidebar(
      "/",
      <NavLink href="/events" label="Events" icon={Calendar} />,
    );
    const link = screen.getByRole("link", { name: /events/i });
    expect(link).not.toHaveAttribute("aria-current", "page");
  });

  it("renders the user menu trigger with the provided email", () => {
    renderSidebar("/");
    // The email appears in the sidebar menu button trigger text.
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders the theme toggle button in the footer", () => {
    renderSidebar("/");
    expect(
      screen.getByRole("button", { name: /toggle theme/i }),
    ).toBeInTheDocument();
  });

  it("is axe-clean", async () => {
    const { container } = renderSidebar(
      "/",
      <>
        <NavLink href="/users" label="Users" icon={Users} />
        <NavLink href="/events" label="Events" icon={Calendar} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
