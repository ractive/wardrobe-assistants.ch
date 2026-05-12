import { format } from "date-fns";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MyBookingListItem } from "../schema";

interface MyBookingsTableProps {
  bookings: MyBookingListItem[];
  emptyMessage?: string;
}

// Squad-member bookings list. iter-39 §A.1: rows are wrapped in a Link to
// `/my-bookings/<id>` (not `/bookings/<id>`, which is admin-only) so the
// whole row is clickable on both card + table layouts. Mirrors the pattern
// from BookingsTable.tsx.
export function MyBookingsTable({
  bookings,
  emptyMessage = "No bookings found.",
}: MyBookingsTableProps) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)] text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (< md) */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label="Bookings list">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <Link
              href={`/my-bookings/${booking.id}`}
              className="block rounded-md hover:bg-[var(--muted)]"
              aria-label={`Open booking ${booking.name}`}
            >
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-base">{booking.name}</span>
                  <StatusBadge
                    kind="assignment"
                    status={booking.assignmentStatus}
                  />
                </div>
                <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-[var(--muted-foreground)]">Date</dt>
                  <dd>{format(booking.date, "yyyy-MM-dd")}</dd>
                  <dt className="text-[var(--muted-foreground)]">Venue</dt>
                  <dd>{booking.venue}</dd>
                  <dt className="text-[var(--muted-foreground)]">
                    Booking status
                  </dt>
                  <dd>
                    <StatusBadge kind="booking" status={booking.status} />
                  </dd>
                </dl>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table (>= md) */}
      <div className="hidden rounded-md border border-[var(--border)] md:block">
        <Table aria-label="Bookings list">
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Booking status</TableHead>
              <TableHead>Assignment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => {
              const href = `/my-bookings/${booking.id}`;
              const cellLink = "block px-2 py-3 hover:bg-transparent";
              return (
                <TableRow
                  key={booking.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="p-0">
                    <Link
                      href={href}
                      className={cellLink}
                      aria-label={`Open booking ${booking.name}`}
                    >
                      <span className="font-medium hover:underline">
                        {booking.name}
                      </span>
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
                      className={cellLink}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      <StatusBadge
                        kind="assignment"
                        status={booking.assignmentStatus}
                      />
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
