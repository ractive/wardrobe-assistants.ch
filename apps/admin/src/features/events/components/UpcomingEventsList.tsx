import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import type { UpcomingEventForRequest } from "../schema";
import { RequestParticipationButton } from "./RequestParticipationButton";

interface UpcomingEventsListProps {
  events: UpcomingEventForRequest[];
}

export function UpcomingEventsList({ events }: UpcomingEventsListProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)] text-sm">
        No upcoming events available for participation right now.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3" aria-label="Upcoming events">
      {events.map((event) => (
        <li key={event.id}>
          <Card className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-base">{event.name}</p>
                <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
                  <div className="flex gap-1">
                    <dt className="sr-only">Date</dt>
                    <dd>{format(event.date, "EEEE, d MMMM yyyy")}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="sr-only">Venue</dt>
                    <dd>{event.venue}</dd>
                  </div>
                </dl>
              </div>
              <RequestParticipationButton eventId={event.id} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
