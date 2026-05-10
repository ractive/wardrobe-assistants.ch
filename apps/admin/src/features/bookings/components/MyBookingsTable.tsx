import { format } from "date-fns";
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
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">{booking.name}</TableCell>
                <TableCell>{format(booking.date, "yyyy-MM-dd")}</TableCell>
                <TableCell>{booking.venue}</TableCell>
                <TableCell>
                  <StatusBadge kind="booking" status={booking.status} />
                </TableCell>
                <TableCell>
                  <StatusBadge
                    kind="assignment"
                    status={booking.assignmentStatus}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
