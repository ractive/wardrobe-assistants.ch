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
import type { EventListItem } from "../schema";
import { RequestsBadge } from "./RequestsBadge";

interface EventsTableProps {
  events: EventListItem[];
  pendingRequestsCountByEvent?: Map<string, number>;
}

export function EventsTable({
  events,
  pendingRequestsCountByEvent,
}: EventsTableProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
        No events yet. Create your first event to start scheduling the squad.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (≤ md) */}
      <ul className="flex flex-col gap-3 md:hidden">
        {events.map((event) => (
          <li
            key={event.id}
            className="rounded-md border border-[var(--border)] bg-[var(--card)]"
          >
            <Link
              href={`/events/${event.id}`}
              className="block p-4 hover:bg-[var(--muted)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-base">{event.name}</span>
                  {pendingRequestsCountByEvent && (
                    <RequestsBadge
                      count={pendingRequestsCountByEvent.get(event.id) ?? 0}
                    />
                  )}
                </div>
                <StatusBadge kind="event" status={event.status} />
              </div>
              <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-[var(--muted-foreground)]">Date</dt>
                <dd>{format(event.date, "yyyy-MM-dd")}</dd>
                <dt className="text-[var(--muted-foreground)]">Venue</dt>
                <dd>{event.venue}</dd>
                <dt className="text-[var(--muted-foreground)]">Assignees</dt>
                <dd className="text-[var(--muted-foreground)]">
                  {event.assigneesCount}
                </dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table (≥ md) */}
      <div className="hidden rounded-md border border-[var(--border)] md:block">
        <Table aria-label="Events">
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
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/events/${event.id}`}
                      className="font-medium hover:underline"
                    >
                      {event.name}
                    </Link>
                    {pendingRequestsCountByEvent && (
                      <RequestsBadge
                        count={pendingRequestsCountByEvent.get(event.id) ?? 0}
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell>{format(event.date, "yyyy-MM-dd")}</TableCell>
                <TableCell>{event.venue}</TableCell>
                <TableCell>
                  <StatusBadge kind="event" status={event.status} />
                </TableCell>
                <TableCell className="text-[var(--muted-foreground)]">
                  {event.assigneesCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
