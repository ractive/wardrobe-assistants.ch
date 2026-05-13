// iter-42 §C: Unit + a11y tests for UnreadBookingsBell.
// Mocks global fetch to avoid real network calls.

import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// next/link renders an <a> in jsdom — no router needed for rendering.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { UnreadBookingsBell } from "./UnreadBookingsBell";

function mockFetch(items: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items }),
    }),
  );
}

// Tests that do NOT need fake timers — real timers keep waitFor / findBy* working.
describe("UnreadBookingsBell (real timers)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    cleanup();
  });

  it("shows zero-count bell with correct aria-label when no items", async () => {
    mockFetch([]);
    const { getByRole } = render(<UnreadBookingsBell />);

    await act(async () => {
      await Promise.resolve();
    });

    const btn = getByRole("button");
    expect(btn).toHaveAttribute("aria-label", "No bookings need attention");
    // Badge span should not be present.
    expect(btn.querySelector("span")).toBeNull();
  });

  it("shows count badge and correct aria-label when items present", async () => {
    mockFetch([
      {
        id: "abc",
        name: "Spring Kickoff",
        date: "2026-06-01T00:00:00.000Z",
        venue: "Studio A",
      },
      {
        id: "def",
        name: "Summer Gig",
        date: "2026-07-01T00:00:00.000Z",
        venue: "Studio B",
      },
    ]);
    const { getByRole } = render(<UnreadBookingsBell />);

    await act(async () => {
      await Promise.resolve();
    });

    const btn = getByRole("button");
    expect(btn).toHaveAttribute("aria-label", "2 bookings need attention");
    const badge = btn.querySelector("span");
    expect(badge?.textContent).toBe("2");
  });

  it("opens popover and lists bookings on click", async () => {
    mockFetch([
      {
        id: "bk1",
        name: "Spring Kickoff",
        date: "2026-06-01T00:00:00.000Z",
        venue: "Studio A",
      },
    ]);
    const { getByRole, findByRole } = render(<UnreadBookingsBell />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(getByRole("button"));
    });

    // Radix Popover renders into a Portal — query on document.body.
    const list = await findByRole("list");
    const link = within(list).getByRole("link");
    expect(link).toHaveAttribute("href", "/bookings/bk1");
    expect(link).toHaveTextContent("Spring Kickoff");
  });

  it("shows all caught up text when popover opened with no items", async () => {
    mockFetch([]);
    const { getByRole } = render(<UnreadBookingsBell />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(getByRole("button"));
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain("All caught up");
    });
  });

  it("is axe-clean in default (closed) state with no items", async () => {
    mockFetch([]);
    const { container } = render(<UnreadBookingsBell />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean with badge showing", async () => {
    mockFetch([
      {
        id: "ax1",
        name: "Axe booking",
        date: "2026-06-01T00:00:00.000Z",
        venue: "Venue X",
      },
    ]);
    const { container } = render(<UnreadBookingsBell />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

// Polling test — isolated with fake timers so we don't actually wait 60 s.
describe("UnreadBookingsBell (fake timers — polling)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    cleanup();
  });

  it("polls /api/bell again after 60 s", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UnreadBookingsBell />);

    // Let the initial fetch complete.
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past the 60-second poll interval.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
