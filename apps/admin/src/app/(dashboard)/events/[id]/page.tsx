import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NoPermissionCard } from "@/components/NoPermissionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { AssigneesPicker } from "@/features/events/components/AssigneesPicker";
import { EventDetailActions } from "@/features/events/components/EventDetailActions";
import { PendingRequestsPanel } from "@/features/events/components/PendingRequestsPanel";
import {
  getEventById,
  listAssignableUsers,
} from "@/features/events/server/queries";
import { getCachedSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCachedSession();
  if (!session) redirect("/login");

  const canView = await userHasPermission("EVENT_VIEW");
  if (!canView) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">Event</h1>
        <NoPermissionCard />
      </section>
    );
  }

  const event = await getEventById(id);
  if (!event) notFound();

  const [canAssign, canDelete, canMessage, canApproveRequests] =
    await Promise.all([
      userHasPermission("EVENT_ASSIGN"),
      userHasPermission("EVENT_DELETE"),
      userHasPermission("EVENT_MESSAGE_ASSIGNED"),
      userHasPermission("EVENT_APPROVE_REQUEST"),
    ]);
  const candidates = canAssign ? await listAssignableUsers() : [];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/events">
            <ArrowLeft className="size-4" aria-hidden="true" /> All events
          </Link>
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-semibold text-2xl md:text-3xl">{event.name}</h1>
            <StatusBadge kind="event" status={event.status} />
          </div>
          <p className="text-[var(--muted-foreground)] text-sm">
            {format(event.date, "EEEE, d MMMM yyyy")} · {event.venue}
          </p>
        </div>
        <EventDetailActions
          event={event}
          canDelete={canDelete}
          canMessage={canMessage}
        />
      </header>
      {event.notes ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="font-medium text-sm">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{event.notes}</p>
        </div>
      ) : null}
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium text-sm">
          Assignees ({event.assignees.length})
        </h2>
        <div className="mt-3">
          {canAssign ? (
            <AssigneesPicker
              eventId={event.id}
              assignees={event.assignees}
              candidates={candidates}
            />
          ) : event.assignees.length === 0 ? (
            <p className="text-[var(--muted-foreground)] text-sm">
              No one assigned yet.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {event.assignees.map((a) => (
                <li
                  key={a.userId}
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                >
                  {a.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {canApproveRequests && event.pendingRequests.length > 0 && (
        <PendingRequestsPanel
          eventId={event.id}
          pendingRequests={event.pendingRequests}
        />
      )}
    </section>
  );
}
