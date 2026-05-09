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

export interface RecentEventItem {
  id: string;
  title: string;
  startAt: Date;
  status: "draft" | "published" | "cancelled" | "done";
  assigneeCount: number;
}

interface RecentEventsTableProps {
  events: RecentEventItem[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function RecentEventsTable({ events }: RecentEventsTableProps) {
  if (events.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No events yet</EmptyTitle>
          <EmptyDescription>
            <Link href="/events/new">Create your first event</Link> to get
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
        {events.map((event) => (
          <Link key={event.id} href={`/events/${event.id}`} className="block">
            <Card className="p-4 transition-colors hover:bg-muted/50">
              <dl className="space-y-1">
                <div>
                  <dt className="sr-only">Event</dt>
                  <dd className="font-medium">{event.title}</dd>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <dt className="sr-only">Date</dt>
                  <dd>{formatDate(event.startAt)}</dd>
                  <span aria-hidden="true">·</span>
                  <dt className="sr-only">Status</dt>
                  <dd>
                    <StatusBadge kind="event" status={event.status} />
                  </dd>
                  <span aria-hidden="true">·</span>
                  <dt className="sr-only">Assignees</dt>
                  <dd>{event.assigneeCount} assigned</dd>
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
            <TableHead>Event</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assignees</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <Link
                  href={`/events/${event.id}`}
                  className="font-medium hover:underline"
                >
                  {event.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(event.startAt)}
              </TableCell>
              <TableCell>
                <StatusBadge kind="event" status={event.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {event.assigneeCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
