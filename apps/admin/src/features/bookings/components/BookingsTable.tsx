import { format } from "date-fns";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BookingListItem } from "../schema";
import { RequestsBadge } from "./RequestsBadge";

interface BookingsTableProps {
  bookings: BookingListItem[];
  pendingRequestsCountByBooking?: Map<string, number>;
}

export function BookingsTable({
  bookings,
  pendingRequestsCountByBooking,
}: BookingsTableProps) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
        No bookings yet. Create your first booking to start scheduling the
        squad.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (≤ md) */}
      <ul className="flex flex-col gap-3 md:hidden">
        {bookings.map((booking) => (
          <li
            key={booking.id}
            className="rounded-md border border-[var(--border)] bg-[var(--card)]"
          >
            <Link
              href={`/bookings/${booking.id}`}
              className="block p-4 hover:bg-[var(--muted)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-base">{booking.name}</span>
                  {booking.isPublicRequest && (
                    <Badge variant="outline" className="text-xs">
                      Public request
                    </Badge>
                  )}
                  {pendingRequestsCountByBooking && (
                    <RequestsBadge
                      count={pendingRequestsCountByBooking.get(booking.id) ?? 0}
                    />
                  )}
                </div>
                <StatusBadge kind="booking" status={booking.status} />
              </div>
              <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-[var(--muted-foreground)]">Date</dt>
                <dd>{format(booking.date, "yyyy-MM-dd")}</dd>
                <dt className="text-[var(--muted-foreground)]">Venue</dt>
                <dd>{booking.venue}</dd>
                <dt className="text-[var(--muted-foreground)]">Assignees</dt>
                <dd className="text-[var(--muted-foreground)]">
                  {booking.assigneesCount}
                </dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table (≥ md) */}
      {/*
       * Whole-row click: each <TableCell> has p-0 so the inner <Link> fills
       * the full cell area. All non-interactive cells wrap their content in a
       * block-level <Link href="/bookings/<id>"> so clicking anywhere on the
       * row navigates without requiring JS router imperative calls (RSC-safe).
       * The RequestsBadge cell is also non-interactive (display-only badge),
       * so it is included in the link region.
       */}
      <div className="hidden rounded-md border border-[var(--border)] md:block">
        <Table aria-label="Bookings">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => {
              const href = `/bookings/${booking.id}`;
              const cellLink = "block px-2 py-3 hover:bg-transparent";
              return (
                <TableRow
                  key={booking.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  {/* Name cell — primary link text */}
                  <TableCell className="p-0">
                    <Link
                      href={href}
                      className={cellLink}
                      aria-label={`Open booking ${booking.name}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium hover:underline">
                          {booking.name}
                        </span>
                        {booking.isPublicRequest && (
                          <Badge variant="outline" className="text-xs">
                            Public request
                          </Badge>
                        )}
                        {pendingRequestsCountByBooking && (
                          <RequestsBadge
                            count={
                              pendingRequestsCountByBooking.get(booking.id) ?? 0
                            }
                          />
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="p-0">
                    <Link
                      href={href}
                      className={cellLink}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      {format(booking.date, "yyyy-MM-dd")}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0">
                    <Link
                      href={href}
                      className={cellLink}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      {booking.venue}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0">
                    <Link
                      href={href}
                      className={cellLink}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      <StatusBadge kind="booking" status={booking.status} />
                    </Link>
                  </TableCell>
                  <TableCell className="p-0">
                    <Link
                      href={href}
                      className={`${cellLink} text-[var(--muted-foreground)]`}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      {booking.assigneesCount}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
