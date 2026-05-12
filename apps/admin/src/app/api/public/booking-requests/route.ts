// iter-26: public, unauthenticated booking-request intake. Receives a JSON
// POST from the homepage `/booking-request` form, creates a `bookings` row in
// status `created` with `createdBy = NULL`, and fires fire-and-forget
// notifications to admins (push + email) and the customer (email autoreply).
//
// Spam defenses are layered:
//   1) Origin allowlist (CORS + same check on POST).
//   2) Zod-validated body — including honeypot, time-check, JS-injected token.
//   3) Rate limit on IP (3/h + 10/d) and customer email (3/d).
// Every rejection from steps 2–8 returns a generic 4xx with no field-level
// diagnostics — we don't help bot authors tune their payloads.
//
// The 200 path is best-effort on notifications: notification failures are
// logged but do not block the response. The booking row + selections are
// authoritative; admins can always discover the request via the booking list.
import {
  bookingServiceSelection,
  bookings,
  services,
} from "@wardrobe-assistants/db/schema";
import { bookingRequestInputSchema } from "@wardrobe-assistants/shared/booking-request-schema";
import { format } from "date-fns";
import { inArray } from "drizzle-orm";
import { ulid } from "ulid";
import { z } from "zod";
import { corsHeaders, isAllowedOrigin } from "@/lib/cors";
import { db } from "@/lib/db";
import { sendTemplated } from "@/lib/email";
import { env } from "@/lib/env";
import { notifyAdmins } from "@/lib/notify";
import {
  clientIpFromHeaders,
  consume,
  RATE_LIMITS,
  retryAfterSeconds,
} from "@/lib/rate-limit";

const TOKEN = "wa-booking-v1";
const MIN_FORM_AGE_MS = 2000;

// Extend the shared customer-input schema with server-only spam-defense fields.
// These are never sent to the client and must not appear in the shared schema.
const payloadSchema = bookingRequestInputSchema.and(
  z.object({
    formLoadedAt: z.number().int().positive(),
    honeypot: z.string(),
    token: z.string(),
  }),
);

type Payload = z.infer<typeof payloadSchema>;

function generic(status: number, headers: Headers): Response {
  return new Response(JSON.stringify({ error: "invalid_request" }), {
    status,
    headers,
  });
}

export async function OPTIONS(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const responseHeaders = new Headers({ "Content-Type": "application/json" });
  // POST is browser-only — modern browsers attach Origin on cross-origin
  // POSTs. Reject anything without an allowlisted Origin so cURL/script
  // callers can't bypass CORS by simply omitting the header.
  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: responseHeaders,
    });
  }
  for (const [k, v] of corsHeaders(origin)) {
    responseHeaders.set(k, v);
  }

  // 1. Parse + validate body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return generic(400, responseHeaders);
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return generic(400, responseHeaders);
  }
  const payload: Payload = parsed.data;

  // 2. Honeypot — must be empty.
  if (payload.honeypot !== "") {
    return generic(400, responseHeaders);
  }
  // 3. Time-check — must be at least MIN_FORM_AGE_MS old.
  if (Date.now() - payload.formLoadedAt < MIN_FORM_AGE_MS) {
    return generic(400, responseHeaders);
  }
  // 4. JS-injected token.
  if (payload.token !== TOKEN) {
    return generic(400, responseHeaders);
  }

  // 5. Rate limit. Normalize email for the per-email bucket.
  const normalizedEmail = payload.customerEmail.trim().toLowerCase();
  const ip = clientIpFromHeaders(req.headers);
  const checks = [
    {
      key: `bookingRequest:ip-hour:${ip}`,
      bucket: RATE_LIMITS.bookingRequestPerIpHour,
    },
    {
      key: `bookingRequest:ip-day:${ip}`,
      bucket: RATE_LIMITS.bookingRequestPerIpDay,
    },
    {
      key: `bookingRequest:email-day:${normalizedEmail}`,
      bucket: RATE_LIMITS.bookingRequestPerEmailDay,
    },
  ];
  for (const c of checks) {
    const r = consume(c.key, c.bucket);
    if (!r.allowed) {
      responseHeaders.set("Retry-After", String(retryAfterSeconds(r)));
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: responseHeaders,
      });
    }
  }

  // 6. Validate service selections — every referenced serviceId must exist
  // and be non-archived.
  const serviceIds = Array.from(
    new Set(payload.serviceSelections.map((s) => s.serviceId)),
  );
  const foundServices = await db
    .select({
      id: services.id,
      name: services.name,
      priceType: services.priceType,
      price: services.price,
      archived: services.archived,
    })
    .from(services)
    .where(inArray(services.id, serviceIds));
  const byId = new Map(foundServices.map((s) => [s.id, s]));
  for (const sel of payload.serviceSelections) {
    const svc = byId.get(sel.serviceId);
    if (!svc || svc.archived) {
      return generic(400, responseHeaders);
    }
  }

  // 7. Insert booking + selections. The booking name doubles as the admin-
  // facing label — derive from the customer name + date for legibility.
  const bookingId = ulid();
  const now = new Date();
  const bookingDate = new Date(`${payload.date}T00:00:00.000Z`);
  const bookingName = `Public request — ${payload.customerName} (${payload.date})`;
  await db.transaction(async (tx) => {
    await tx.insert(bookings).values({
      id: bookingId,
      name: bookingName,
      date: bookingDate,
      // `venue` doubles as the human-readable label for admin list views;
      // compose venue name + city from the public form fields.
      venue: `${payload.venue}, ${payload.city}`,
      notes: null,
      status: "created",
      createdBy: null,
      offerToken: crypto.randomUUID(),
      offerVersion: 0,
      customerName: payload.customerName,
      customerEmail: normalizedEmail,
      customerPhone: payload.customerPhone,
      startTime: payload.startTime,
      durationHours: payload.durationHours,
      city: payload.city,
      comment: payload.comment ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(bookingServiceSelection).values(
      payload.serviceSelections.map((s, idx) => ({
        id: ulid(),
        bookingId,
        serviceId: s.serviceId,
        quantity: s.quantity,
        position: idx,
      })),
    );
  });

  // 8. Fire-and-forget notifications — errors must not block the 200.
  const bookingDateStr = format(bookingDate, "EEEE, d MMMM yyyy");
  const serviceLines = payload.serviceSelections.map((s) => {
    const svc = byId.get(s.serviceId);
    if (!svc) return `${s.quantity}× (unknown)`;
    return `${s.quantity}× ${svc.name}`;
  });
  const summary = [
    `When: ${bookingDateStr} at ${payload.startTime} (${payload.durationHours}h)`,
    `Where: ${payload.venue}, ${payload.city}`,
    ...serviceLines.map((l) => `- ${l}`),
  ];
  const bookingUrl = `${env.betterAuthUrl}/bookings/${bookingId}`;

  notifyAdmins("bookingRequested", {
    bookingId,
    customerName: payload.customerName,
    customerEmail: normalizedEmail,
    customerPhone: payload.customerPhone,
    city: payload.city,
    venue: payload.venue,
    date: bookingDateStr,
    startTime: payload.startTime,
    durationHours: payload.durationHours,
    comment: payload.comment ?? undefined,
    serviceLines,
    bookingUrl,
  }).catch((err) => {
    console.error("[public/booking-requests] notifyAdmins failed", err);
  });

  sendTemplated("bookingRequestReceived", normalizedEmail, {
    customerName: payload.customerName,
    summary,
  }).catch((err) => {
    console.error("[public/booking-requests] autoreply failed", err);
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: responseHeaders,
  });
}
