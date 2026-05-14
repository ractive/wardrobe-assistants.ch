"use client";

// iter-42 §C: Bell icon with unread badge in the dashboard header.
//
// Derivation rules (from /api/bell):
//   Admin      — unassigned pending bookings (status=created, no confirmed/assigned row).
//   Squad      — bookings assigned to me in `assigned` status (pending my confirmation).
//
// Refreshes on window focus and polls every 60 s. No "mark read" UI; the badge
// clears naturally when the underlying booking state changes.

import { format } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BellItemResponse {
  id: string;
  name: string;
  date: string; // ISO string from the API
  venue: string;
  href: string;
}

const POLL_INTERVAL_MS = 60_000;

function isBellItem(value: unknown): value is BellItemResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.date === "string" &&
    typeof v.venue === "string" &&
    typeof v.href === "string" &&
    v.href.startsWith("/") &&
    !v.href.startsWith("//")
  );
}

function isBellItemArray(value: unknown): value is BellItemResponse[] {
  return Array.isArray(value) && value.every(isBellItem);
}

export function UnreadBookingsBell() {
  const [items, setItems] = useState<BellItemResponse[]>([]);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBell = useCallback(async () => {
    try {
      const res = await fetch("/api/bell", { credentials: "same-origin" });
      if (res.status === 401) {
        // Session expired (e.g. signed out in another tab) — clear the badge
        // so it doesn't keep showing a stale count.
        setItems([]);
        return;
      }
      if (!res.ok) {
        console.warn(`bell: fetch failed status=${res.status}`);
        return;
      }
      const raw: unknown = await res.json();
      // Defensive parse — only accept items: BellItemResponse[] with the
      // expected fields. Anything else falls back to empty so a misshaped
      // response can't crash the render.
      const items = isBellItemArray((raw as { items?: unknown } | null)?.items)
        ? (raw as { items: BellItemResponse[] }).items
        : [];
      setItems(items);
    } catch (err) {
      // Network error — keep the last-known count so the badge doesn't
      // flicker, but surface the error so dev tools see it.
      console.warn("bell: fetch error", err);
    }
  }, []);

  useEffect(() => {
    void fetchBell();

    intervalRef.current = setInterval(() => {
      void fetchBell();
    }, POLL_INTERVAL_MS);

    const handleFocus = () => {
      void fetchBell();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchBell]);

  const count = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            count > 0
              ? `${count} booking${count === 1 ? "" : "s"} need attention`
              : "No bookings need attention"
          }
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="font-semibold text-sm">
            {count > 0
              ? `${count} booking${count === 1 ? "" : "s"} need attention`
              : "All caught up"}
          </p>
        </div>
        {count === 0 ? (
          <p className="px-4 py-3 text-muted-foreground text-sm">
            Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const dateStr = (() => {
                try {
                  return format(new Date(item.date), "d MMM yyyy");
                } catch {
                  return item.date;
                }
              })();
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-0.5 px-4 py-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={() => setOpen(false)}
                  >
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {dateStr} &middot; {item.venue}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
