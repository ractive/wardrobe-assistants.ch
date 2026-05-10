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
import type { MyEventListItem } from "../schema";

interface MyEventsTableProps {
  events: MyEventListItem[];
  emptyMessage?: string;
}

export function MyEventsTable({
  events,
  emptyMessage = "No events found.",
}: MyEventsTableProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)] text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (< md) */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label="Events list">
        {events.map((event) => (
          <li key={event.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-base">{event.name}</span>
                <StatusBadge
                  kind="assignment"
                  status={event.assignmentStatus}
                />
              </div>
              <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-[var(--muted-foreground)]">Date</dt>
                <dd>{format(event.date, "yyyy-MM-dd")}</dd>
                <dt className="text-[var(--muted-foreground)]">Venue</dt>
                <dd>{event.venue}</dd>
                <dt className="text-[var(--muted-foreground)]">Event status</dt>
                <dd>
                  <StatusBadge kind="event" status={event.status} />
                </dd>
              </dl>
            </Card>
          </li>
        ))}
      </ul>

      {/* Desktop: table (>= md) */}
      <div className="hidden rounded-md border border-[var(--border)] md:block">
        <Table aria-label="Events list">
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Event status</TableHead>
              <TableHead>Assignment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>{format(event.date, "yyyy-MM-dd")}</TableCell>
                <TableCell>{event.venue}</TableCell>
                <TableCell>
                  <StatusBadge kind="event" status={event.status} />
                </TableCell>
                <TableCell>
                  <StatusBadge
                    kind="assignment"
                    status={event.assignmentStatus}
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
