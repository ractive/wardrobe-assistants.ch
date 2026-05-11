import { bookingAssignments, bookings } from "@wardrobe-assistants/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCachedSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { assertPermission, PermissionError } from "@/lib/permissions";

// Static VTIMEZONE block for Europe/Zurich. RFC 5545 §3.6.5. Standard CET/CEST
// transition rules on the last Sunday of March / October. Embedding the block
// (vs. emitting `DTSTART;TZID=...` alone) keeps Outlook and Apple Calendar
// from defaulting to UTC.
const VTIMEZONE_EUROPE_ZURICH = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Zurich",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

// RFC 5545 §3.3.11: escape `, ; \` and newlines in TEXT values.
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// bookings.date is stored as midnight UTC (a date-only field). Using getUTC*
// getters here is intentional and correct: the value was written as
// YYYY-MM-DD with no time component, so the UTC date parts equal the
// calendar date that was stored. The local time-of-day (hh/mm) comes from
// the separate startTime column and is emitted as a TZID-qualified timestamp
// (Europe/Zurich), so no UTC-to-local conversion is needed here.
function toLocalIcsDate(date: Date, hh: number, mm: number): string {
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  return `${y}${mo}${d}T${pad(hh)}${pad(mm)}00`;
}

function dtstampUtc(now: Date): string {
  const y = now.getUTCFullYear();
  const mo = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  return `${y}${mo}${d}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const session = await getCachedSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await assertPermission("SQUAD_VIEW_ASSIGNED");
  } catch (err) {
    if (err instanceof PermissionError) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    throw err;
  }

  const { bookingId } = await params;

  const rows = await db
    .select({
      bookingId: bookings.id,
      name: bookings.name,
      date: bookings.date,
      venue: bookings.venue,
      venueName: bookings.venueName,
      venueCity: bookings.venueCity,
      comment: bookings.comment,
      startTime: bookings.startTime,
      durationHours: bookings.durationHours,
      assignmentStatus: bookingAssignments.status,
    })
    .from(bookingAssignments)
    .innerJoin(bookings, eq(bookings.id, bookingAssignments.bookingId))
    .where(
      and(
        eq(bookingAssignments.bookingId, bookingId),
        eq(bookingAssignments.userId, session.user.id),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.assignmentStatus !== "confirmed") {
    return new NextResponse("Not found", { status: 404 });
  }

  // Validate startTime: must match HH:MM with numeric range checks.
  // Fall back to 09:00 if missing or invalid.
  const START_TIME_RE = /^\d{1,2}:\d{1,2}$/;
  let startHour = 9;
  let startMin = 0;
  if (row.startTime && START_TIME_RE.test(row.startTime)) {
    const [hStr, mStr] = row.startTime.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (
      Number.isFinite(h) &&
      Number.isFinite(m) &&
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59
    ) {
      startHour = h;
      startMin = m;
    }
  }

  const durHours = row.durationHours ?? 2;
  const endTotalMin = startHour * 60 + startMin + durHours * 60;

  // Cross-midnight: when endTotalMin >= 1440 (24 * 60), the end falls on the
  // next calendar day. Compute proper Date objects so DTEND uses the correct date.
  const startDate = row.date;
  let endDate: Date;
  if (endTotalMin >= 1440) {
    endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + Math.floor(endTotalMin / 1440));
  } else {
    endDate = startDate;
  }
  const endHour = Math.floor(endTotalMin / 60) % 24;
  const endMin = endTotalMin % 60;

  const dtStart = toLocalIcsDate(startDate, startHour, startMin);
  const dtEnd = toLocalIcsDate(endDate, endHour, endMin);

  const venueParts = [row.venueName ?? row.venue, row.venueCity].filter(
    (s): s is string => Boolean(s),
  );
  const location = escapeIcsText(venueParts.join(", "));
  const summary = escapeIcsText(`Wardrobe Assistants — ${row.name}`);
  const detailUrl = `${env.betterAuthUrl}/my-bookings/${row.bookingId}`;
  const descLines = [row.comment ?? "", `\n\nDetails: ${detailUrl}`]
    .filter(Boolean)
    .join("");
  const description = escapeIcsText(
    descLines || `See ${detailUrl} for booking details.`,
  );

  const safeBookingId = row.bookingId.replace(/[^a-zA-Z0-9_-]/g, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wardrobe Assistants//Admin//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE_EUROPE_ZURICH,
    "BEGIN:VEVENT",
    `UID:booking-${row.bookingId}@wardrobe-assistants.ch`,
    `DTSTAMP:${dtstampUtc(new Date())}`,
    `DTSTART;TZID=Europe/Zurich:${dtStart}`,
    `DTEND;TZID=Europe/Zurich:${dtEnd}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const ics = `${lines.join("\r\n")}\r\n`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${safeBookingId}.ics"`,
    },
  });
}
