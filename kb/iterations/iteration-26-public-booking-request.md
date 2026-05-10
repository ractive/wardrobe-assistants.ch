---
title: Iteration 26 — Public booking-request flow
type: iteration
order: 27
status: planned
---

# Iteration 26 — Public booking-request flow

The customer-facing entry point. A static-export page on the homepage app posts a JSON payload to a new public, unauthenticated route on the admin app. Successful submissions create a `bookings` row in status `created` (with `createdBy = NULL`), record the customer's service selections, send an immediate confirmation email to the customer, and notify all verified admins via push + email.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. The "send offer" step that follows lives in [iter-27](iteration-27-offer-flow.md); this iteration intentionally stops at intake.

## Decisions

- **Form lives on the homepage** (`apps/homepage`, static export). It POSTs cross-origin to admin at `https://admin.wardrobe-assistants.ch/api/public/booking-requests`.
- **CORS allowlist is hardcoded** in admin code: `https://wardrobe-assistants.ch`, `https://www.wardrobe-assistants.ch`, plus `http://localhost:*` when `NODE_ENV !== 'production'`. **No env var.** Keeps the production-allowed origins reviewable in source.
- **Form requires JavaScript.** Accepted trade-off. The JS-injected token defense depends on it.
- **Spam defenses in v1**: honeypot field + ≥2 s time-check + JS-injected token + IP/email rate limiting. **No Turnstile / hCaptcha.** Re-evaluate only if abuse appears.
- **Service catalog shown** = `services WHERE archived = false`. Prices shown with a disclaimer that the final price is in the offer and call-out fees may apply.
- **Static call-out-fee notice** when `venueCity` does not match Zurich (case- and diacritic-insensitive). Notice copy: "Locations outside Zurich incur a call-out fee, which will be included in your offer."
- **Single static success block**, inline, same page. Plus a `bookingRequestReceived` confirmation email.
- **Indefinite retention** of customer PII (Swiss FADP 10-year invoice-retention rationale). `/datenschutz` updated to disclose. No purge job in v1.

## Pre-flight

- [ ] [iter-25](iteration-25-booking-domain.md) merged on `main` and deployed; new schema columns live in prod DB.
- [ ] Verify `services` table has at least one non-archived row in prod — otherwise the form has nothing to render. Coordinate with operator if empty.
- [ ] No in-flight branches touching `apps/homepage/src/app/` or `apps/admin/src/app/api/`.
- [ ] `npm run verify` green on `main`.

## Scope

### 1. Homepage — `apps/homepage/src/app/booking-request/page.tsx`

Static-export page. Renders the booking-request form.

Fields (all required unless noted):

- `customerName: string`
- `customerEmail: string` (email validation)
- `customerPhone: string`
- `date: string` ("YYYY-MM-DD", future date)
- `startTime: string` ("HH:MM", 24h)
- `durationHours: integer` (≥5)
- `venueName: string`
- `venueCity: string`
- `serviceSelections: Array<{ serviceId, quantity }>` (≥1 row)
- `comment: string` (optional)

UI:

- Service catalog rendered from a build-time fetch of `services` (call-out path: admin app exposes a public `GET /api/public/services` returning `id, name, description, priceType, unitPriceCents` for non-archived rows; the homepage fetches at request time via the static export's data-fetching path — concretely a server-component fetch with `revalidate` per Next.js static-export semantics). Verify the Next.js 16 static-export contract in `node_modules/next/dist/docs/` before implementing.
- For each service row in the catalog: quantity input (label varies by `priceType` — "Number of items / people" for both; hours are derived server-side from `durationHours` at snapshot time).
- Static notice block above submit: "Breaks and dinner breaks are coordinated based on the duration of duty. Minimum time of duty is 5 hours."
- Dynamic notice: when `venueCity` is non-empty and does not match Zurich (normalize: lowercase + strip diacritics), show the call-out-fee notice.
- Always-visible email fallback link below submit: "Trouble submitting? Email `hello@wardrobe-assistants.ch`."
- Honeypot input: `name="website"`, visually hidden via CSS (off-screen position, `width: 1px; height: 1px; overflow: hidden;`), `autocomplete="off"`, `tabindex="-1"`, `aria-hidden="true"`.
- Time-check: capture `formLoadedAt = Date.now()` in a `useEffect` (or `useState` initializer) on mount; submit as a hidden payload field.
- JS-injected token: a constant string (e.g. `"wa-booking-v1"`) injected by a client `useEffect` into a hidden input. Server rejects requests where the field is absent or doesn't match.

Submit:

- Client posts JSON to `https://admin.wardrobe-assistants.ch/api/public/booking-requests` (or the localhost equivalent in dev).
- On 2xx: render an inline success block with the submitted details and a "Submit another request" link.
- On 4xx (other than 429): generic error message + email fallback.
- On 429: friendly "Too many requests, please try again later. Email `hello@wardrobe-assistants.ch`."

### 2. Homepage — link from `/services`

Add a clear CTA on `apps/homepage/src/app/services/page.tsx` linking to `/booking-request`.

### 3. Homepage — `/datenschutz` update

Add a section disclosing:

- Customer contact data (name, email, phone) collected via the booking-request form.
- Retention: indefinite, for legal/invoice reasons (Swiss 10-year retention obligation).
- How to request deletion: email `hello@wardrobe-assistants.ch`.

Narrow targeted edit; do not rewrite the page.

### 4. Admin — `GET /api/public/services`

Public, unauthenticated, CORS-allowed for the homepage origins. Returns `{ id, name, description, priceType, unitPriceCents }` for non-archived services. Rate limit: 60/min/IP via `lib/rate-limit.ts`. Smoke-tested.

### 5. Admin — `POST /api/public/booking-requests`

`apps/admin/src/app/api/public/booking-requests/route.ts`. Route group `api/public/` is outside `(dashboard)`; no auth.

Pipeline:

1. **CORS preflight** (`OPTIONS`): respond with `Access-Control-Allow-Origin` matching the request `Origin` if in the allowlist, else 403. `Access-Control-Allow-Methods: POST`, `Access-Control-Allow-Headers: Content-Type`. `Vary: Origin`.
2. **Origin check** on `POST`: reject if `Origin` not in allowlist.
3. **Body parse + zod validation** of the full payload, including `formLoadedAt: number`, `honeypot: string`, `token: string`.
4. **Honeypot**: reject if `honeypot !== ""`.
5. **Time-check**: reject if `Date.now() - formLoadedAt < 2000`.
6. **Token check**: reject if `token !== "wa-booking-v1"`.
7. **Rate limit** via `lib/rate-limit.ts` new bucket `bookingRequest`:
   - 3 / hour per IP
   - 10 / day per IP
   - 3 / day per `customerEmail` (normalized lowercase + trim)
   - On bucket exhaustion: HTTP 429 with `Retry-After`.
8. **Validate service selections**: every `serviceId` must exist and be non-archived. Reject otherwise.
9. **Insert** `bookings` row: `status='created'`, `createdBy=NULL`, `offerToken = randomUUID()`, all contact + venue + time fields populated, `offerVersion=0`.
10. **Insert** `booking_service_selection` rows (one per selection, `position` from array index).
11. **Fire-and-forget** notifications:
    - `notifyAdmins('bookingRequested', { bookingId, customerName, venueCity, date })` (see §6 below).
    - `sendTemplated('bookingRequestReceived', customerEmail, { customerName, bookingId, summary })`.
12. **Respond 200** with `{ ok: true }`. No echo of input — no info leak to bots.

For all rejection cases (steps 2–8): respond 4xx with a generic error body. Do not return field-level diagnostics that help bot authors tune their payloads.

### 6. Admin — `notifyAdmins` helper in `lib/notify.ts`

```ts
export async function notifyAdmins<K extends NotifiableTemplateKey>(
  templateKey: K,
  params: NotifyParamsFor<K>,
): Promise<void> {
  const admins = await db
    .select({ id: userProfile.userId })
    .from(userProfile)
    .where(and(eq(userProfile.role, "ADMIN"), eq(userProfile.status, "verified")));
  await Promise.allSettled(
    admins.map((a) => notifyUser(a.id, templateKey, params)),
  );
}
```

- Reuses `notifyUser` from [iter-23](iteration-23-admin-pwa-web-push.md) — fires both push and email per admin.
- `Promise.allSettled` so one bad recipient doesn't drop notifications for the rest.

### 7. Notification templates

- **`bookingRequested`** (admins; push + email). Push payload: `{ title: "New booking request", body: "<customer> · <date> · <city>", url: "/bookings/<id>" }`. Email template summarizes the request and CTAs to the admin booking-detail page.
- **`bookingRequestReceived`** (customer; email only). Polite autoreply confirming receipt and explaining that an offer will follow. English only.

### 8. Admin booking list — "from public form" indicator

Booking list rows where `createdBy IS NULL` show a small "Public" pill (visual treatment matches existing badges; consult `kb/admin-architecture/design-system.md`).

### 9. CORS allowlist constant

```ts
// apps/admin/src/lib/cors.ts
const PROD_ORIGINS = [
  "https://wardrobe-assistants.ch",
  "https://www.wardrobe-assistants.ch",
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}
```

Used by `GET /api/public/services` and `POST /api/public/booking-requests`.

### 10. Smoke tests

- CORS preflight: allowed origin gets 200 with correct headers; disallowed origin gets 403.
- Honeypot non-empty → 4xx, no booking row created.
- Time-check < 2 s → 4xx, no booking row created.
- Missing/wrong token → 4xx.
- Invalid `serviceId` (archived or unknown) → 4xx.
- Valid submission → 200, row in `bookings` with `createdBy IS NULL` and `status='created'`, rows in `booking_service_selection`, `bookingRequested` notification dispatched (mock `notifyUser`), `bookingRequestReceived` email dispatched (mock `sendTemplated`).
- Rate-limit: 4th request in an hour from the same IP → 429 with `Retry-After`.
- `GET /api/public/services` returns only non-archived services.

## Out of scope

- "Send offer" / offer page — [iter-27](iteration-27-offer-flow.md).
- Turnstile / hCaptcha.
- PII purge job.
- German translation of the form / emails. English only in v1.
- Date-picker / time-picker UI polish beyond standard `<input type="date">` / `<input type="time">`.
- Multi-step form / wizard. Single page.
- Address fields beyond venue name + city.
- Customer accounts / login.

## Done when

- [ ] `/booking-request` renders on the homepage with all fields; honeypot, time-check, and JS-token are wired client-side.
- [ ] Submit success renders inline confirmation; submit failure renders the friendly error + email fallback.
- [ ] `/datenschutz` updated to disclose the new data collection.
- [ ] `GET /api/public/services` returns the active catalog; CORS preflight works for the allowed origins.
- [ ] `POST /api/public/booking-requests` end-to-end creates a `bookings` row + `booking_service_selection` rows for valid submissions, and rejects every spam-defense case.
- [ ] `notifyAdmins` helper present in `lib/notify.ts`; `bookingRequested` and `bookingRequestReceived` templates landed; both push payloads and email bodies render against the harness fixtures.
- [ ] Rate limiter has a `bookingRequest` bucket with the documented limits; 429 returns `Retry-After`.
- [ ] Admin booking list shows the "Public" indicator for `createdBy IS NULL` rows.
- [ ] Smoke tests pass for every step in §10.
- [ ] `npm run format` clean; `npm run verify` green.
- [ ] System deployable; manual smoke on a preview deploy confirms a real cross-origin submit creates the booking and emits both notifications.
- [ ] No UI exposes "Send offer" or the customer-facing offer page yet — those land in [iter-27](iteration-27-offer-flow.md).
