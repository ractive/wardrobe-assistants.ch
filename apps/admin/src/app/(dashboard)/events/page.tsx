import { redirect } from "next/navigation";
import { NoPermissionCard } from "@/components/NoPermissionCard";
import { CreateEventDialog } from "@/features/events/components/EventDialog";
import { EventsTable } from "@/features/events/components/EventsTable";
import { listEvents } from "@/features/events/server/queries";
import { getCachedSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";

export default async function EventsPage() {
  const session = await getCachedSession();
  if (!session) redirect("/login");

  const allowed = await userHasPermission("EVENT_CREATE");
  if (!allowed) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">Events</h1>
        <NoPermissionCard />
      </section>
    );
  }

  const events = await listEvents();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-semibold text-2xl md:text-3xl">Events</h1>
          <p className="text-[var(--muted-foreground)] text-sm">
            Schedule events, assign squad members, and message assignees.
          </p>
        </div>
        <CreateEventDialog />
      </header>
      <EventsTable events={events} />
    </section>
  );
}
