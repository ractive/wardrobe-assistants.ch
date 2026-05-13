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
}

interface BellApiResponse {
  items?: BellItemResponse[];
  error?: string;
}

const POLL_INTERVAL_MS = 60_000;

export function UnreadBookingsBell() {
  const [items, setItems] = useState<BellItemResponse[]>([]);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBell = useCallback(async () => {
    try {
      const res = await fetch("/api/bell", { credentials: "same-origin" });
      if (!res.ok) return;
      const data: BellApiResponse = (await res.json()) as BellApiResponse;
      setItems(data.items ?? []);
    } catch {
      // Network error — keep the last-known count so the badge doesn't flicker.
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
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground"
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
                    href={`/bookings/${item.id}`}
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
