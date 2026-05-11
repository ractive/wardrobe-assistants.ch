import { bookingAssignments, bookings } from "@wardrobe-assistants/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCachedSession } from "@/lib/auth";
import { db } from "@/lib/db";

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

  // Default 09:00 if no start time was captured; default 2h if no duration.
  const [hStr, mStr] = (row.startTime ?? "09:00").split(":");
  const startHour = Number(hStr ?? "9");
  const startMin = Number(mStr ?? "0");
  const durHours = row.durationHours ?? 2;
  const endTotalMin = startHour * 60 + startMin + durHours * 60;
  const endHour = Math.floor(endTotalMin / 60) % 24;
  const endMin = endTotalMin % 60;

  const dtStart = toLocalIcsDate(row.date, startHour, startMin);
  const dtEnd = toLocalIcsDate(row.date, endHour, endMin);

  const venueParts = [row.venueName ?? row.venue, row.venueCity].filter(
    (s): s is string => Boolean(s),
  );
  const location = escapeIcsText(venueParts.join(", "));
  const summary = escapeIcsText(`Wardrobe Assistants — ${row.name}`);
  const detailUrl = `/my-bookings/${row.bookingId}`;
  const descLines = [row.comment ?? "", `\n\nDetails: ${detailUrl}`]
    .filter(Boolean)
    .join("");
  const description = escapeIcsText(
    descLines || `See ${detailUrl} for booking details.`,
  );

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
      "Content-Disposition": `attachment; filename="booking-${row.bookingId}.ics"`,
    },
  });
}
