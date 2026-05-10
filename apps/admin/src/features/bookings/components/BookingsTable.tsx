import { format } from "date-fns";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
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
                <div className="flex items-center gap-2">
                  <span className="font-medium text-base">{booking.name}</span>
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
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="font-medium hover:underline"
                    >
                      {booking.name}
                    </Link>
                    {pendingRequestsCountByBooking && (
                      <RequestsBadge
                        count={
                          pendingRequestsCountByBooking.get(booking.id) ?? 0
                        }
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell>{format(booking.date, "yyyy-MM-dd")}</TableCell>
                <TableCell>{booking.venue}</TableCell>
                <TableCell>
                  <StatusBadge kind="booking" status={booking.status} />
                </TableCell>
                <TableCell className="text-[var(--muted-foreground)]">
                  {booking.assigneesCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
