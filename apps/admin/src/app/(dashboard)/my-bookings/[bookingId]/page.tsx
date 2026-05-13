import { bookingAssignments, bookings } from "@wardrobe-assistants/db/schema";
import { format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { AssignmentActionPrompt } from "@/features/bookings/components/AssignmentActionPrompt";
import { AssignmentInlineActions } from "@/features/bookings/components/AssignmentInlineActions";
import { IcsDownloadButton } from "@/features/bookings/components/IcsDownloadButton";
import { WithdrawAssignmentDialog } from "@/features/bookings/components/WithdrawAssignmentDialog";
import { getCachedSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";

type SearchParams = { action?: string };

function parseAction(raw: string | undefined): "confirm" | "decline" | null {
  if (raw === "confirm" || raw === "decline") return raw;
  return null;
}

export default async function MyBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await getCachedSession();
  if (!session) redirect("/login");

  await assertPermission("SQUAD_VIEW_ASSIGNED");

  const { bookingId } = await params;
  const { action } = await searchParams;
  const defaultAction = parseAction(action);

  const assignmentRows = await db
    .select()
    .from(bookingAssignments)
    .where(
      and(
        eq(bookingAssignments.bookingId, bookingId),
        eq(bookingAssignments.userId, session.user.id),
      ),
    )
    .limit(1);
  const assignment = assignmentRows[0];

  if (!assignment) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">Booking</h1>
        <Card className="border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">
            You don't have an assignment for this booking.
          </p>
          <p className="mt-1 text-sm">
            If you think this is wrong, ask an admin to check your assignment.
          </p>
        </Card>
      </section>
    );
  }

  const bookingRows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  const booking = bookingRows[0];
  if (!booking) {
    // Race: assignment row exists but booking row is gone (cascade ought to
    // have deleted the assignment too, but defend against the transient
    // window).
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">Booking</h1>
        <Card className="p-6 text-sm">
          This booking is no longer available.
        </Card>
      </section>
    );
  }

  // isTerminal: assignment-level terminal states OR booking itself in a
  // terminal state (cancelled or rejected). Neither has a valid
  // confirm/decline path, so suppress the AssignmentActionPrompt even when
  // ?action= is present in the URL. Mirrors the (cancelled || rejected) pair
  // used in features/bookings/server/actions.ts.
  const isTerminal =
    assignment.status === "rejected" ||
    assignment.status === "withdrawn" ||
    booking.status === "cancelled" ||
    booking.status === "rejected";
  const isConfirmed = assignment.status === "confirmed";

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl md:text-3xl">{booking.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge kind="booking" status={booking.status} />
          <StatusBadge kind="assignment" status={assignment.status} />
        </div>
      </header>

      {!isTerminal && (
        <AssignmentActionPrompt
          bookingId={bookingId}
          defaultAction={defaultAction}
        />
      )}

      {isTerminal && booking.status === "accepted" && (
        <Card className="border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {assignment.status === "rejected"
              ? "You declined this assignment."
              : "You withdrew from this assignment."}
          </p>
          <p className="mt-1 text-amber-800 text-sm dark:text-amber-200">
            Changed your mind? You can confirm again below.
          </p>
        </Card>
      )}

      <Card className="flex flex-col gap-2 p-4">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-[var(--muted-foreground)]">Date</dt>
          <dd>{format(booking.date, "EEEE, d MMMM yyyy")}</dd>
          {booking.startTime ? (
            <>
              <dt className="text-[var(--muted-foreground)]">Time</dt>
              <dd>{booking.startTime}</dd>
            </>
          ) : null}
          {booking.durationHours ? (
            <>
              <dt className="text-[var(--muted-foreground)]">Duration</dt>
              <dd>{booking.durationHours}h</dd>
            </>
          ) : null}
          <dt className="text-[var(--muted-foreground)]">Venue</dt>
          <dd>
            {booking.venue}
            {booking.city ? `, ${booking.city}` : null}
          </dd>
          {booking.comment ? (
            <>
              <dt className="text-[var(--muted-foreground)]">Comment</dt>
              <dd className="whitespace-pre-wrap">{booking.comment}</dd>
            </>
          ) : null}
        </dl>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {assignment.status !== "requested" && (
          <AssignmentInlineActions
            bookingId={bookingId}
            status={assignment.status}
          />
        )}
        {isConfirmed && <IcsDownloadButton bookingId={bookingId} />}
        {isConfirmed && <WithdrawAssignmentDialog bookingId={bookingId} />}
      </div>
    </section>
  );
}
