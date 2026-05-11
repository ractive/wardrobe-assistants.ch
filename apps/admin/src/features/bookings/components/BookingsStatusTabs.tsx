"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingStatusFilter } from "../server/queries";

const TABS: { label: string; value: BookingStatusFilter }[] = [
  { label: "New requests", value: "new-requests" },
  { label: "Offered", value: "offered" },
  { label: "Accepted", value: "accepted" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Cancelled", value: "cancelled" },
  { label: "All", value: "all" },
];

interface BookingsStatusTabsProps {
  activeFilter: BookingStatusFilter;
  newRequestsCount: number;
}

export function BookingsStatusTabs({
  activeFilter,
  newRequestsCount,
}: BookingsStatusTabsProps) {
  const router = useRouter();

  function buildHref(filter: BookingStatusFilter): string {
    return filter === "all" ? "/bookings" : `/bookings?status=${filter}`;
  }

  return (
    <>
      {/* Mobile: Select (<640px) */}
      <div className="sm:hidden">
        <Select
          value={activeFilter}
          onValueChange={(val) => {
            router.push(buildHref(val as BookingStatusFilter));
          }}
        >
          <SelectTrigger
            aria-label="Filter bookings by status"
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                {tab.label}
                {tab.value === "new-requests" && newRequestsCount > 0
                  ? ` (${newRequestsCount})`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: link tabs (≥640px) */}
      <nav
        aria-label="Booking status filter"
        className="hidden sm:flex flex-wrap gap-1 border-b border-[var(--border)] pb-0"
      >
        {TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          return (
            <Link
              key={tab.value}
              href={buildHref(tab.value)}
              aria-current={isActive ? "page" : undefined}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px",
                "motion-safe:transition-colors motion-safe:duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground",
              ].join(" ")}
            >
              {tab.label}
              {tab.value === "new-requests" && newRequestsCount > 0 && (
                <Badge
                  variant="secondary"
                  aria-label={`${newRequestsCount} new request${newRequestsCount === 1 ? "" : "s"}`}
                  className="text-xs"
                >
                  {newRequestsCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
