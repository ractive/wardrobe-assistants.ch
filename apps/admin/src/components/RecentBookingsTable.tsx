import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";

export interface RecentBookingItem {
  id: string;
  title: string;
  startAt: Date;
  status: "created" | "offered" | "accepted" | "rejected" | "cancelled";
  assigneeCount: number;
}

interface RecentBookingsTableProps {
  bookings: RecentBookingItem[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function RecentBookingsTable({ bookings }: RecentBookingsTableProps) {
  if (bookings.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No bookings yet</EmptyTitle>
          <EmptyDescription>
            <Link href="/bookings">Create your first booking</Link> to get
            started.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent />
      </Empty>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/bookings/${booking.id}`}
            className="block"
          >
            <Card className="p-4 transition-colors hover:bg-muted/50">
              <dl className="space-y-1">
                <div>
                  <dt className="sr-only">Booking</dt>
                  <dd className="font-medium">{booking.title}</dd>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <dt className="sr-only">Date</dt>
                  <dd>{formatDate(booking.startAt)}</dd>
                  <span aria-hidden="true">·</span>
                  <dt className="sr-only">Status</dt>
                  <dd>
                    <StatusBadge kind="booking" status={booking.status} />
                  </dd>
                  <span aria-hidden="true">·</span>
                  <dt className="sr-only">Assignees</dt>
                  <dd>{booking.assigneeCount} assigned</dd>
                </div>
              </dl>
            </Card>
          </Link>
        ))}
      </div>

      {/* Desktop: table */}
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assignees</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell>
                <Link
                  href={`/bookings/${booking.id}`}
                  className="font-medium hover:underline"
                >
                  {booking.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(booking.startAt)}
              </TableCell>
              <TableCell>
                <StatusBadge kind="booking" status={booking.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {booking.assigneeCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
