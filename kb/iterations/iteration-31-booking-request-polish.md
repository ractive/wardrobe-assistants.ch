---
title: Iteration 31 — Booking-request page polish + proxy fix
type: iteration
order: 32
status: planned
---

# Iteration 31 — Booking-request page polish + proxy fix

Fix the customer-facing entry point. The `/booking-request` page on the homepage has shipped since [iter-26](iteration-26-public-booking-request.md) but the path it depends on (`/api/public/*` on admin) is silently auth-gated, so the form has **never** completed a real end-to-end flow in production: the build-time service-catalog fetch returns 307→/login, the form renders with the empty-state copy, and the customer can't submit even if they tried. This iteration also tightens form ergonomics that came out of manual testing: validation feedback, layout, the duration-input bug, and discoverability from the homepage Nav + Hero.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. After this, a visitor to `https://wardrobe-assistants.ch` sees a clear "Request a booking" CTA, lands on a styled form, fills it in with per-field validation feedback, and submits successfully.

## Decisions

- **Hot-fix the proxy allowlist inside this iteration**, not as a separate emergency change. The customer flow has been broken since [iter-26](iteration-26-public-booking-request.md) merged; one more deploy cycle is the right cadence to land it alongside the form-side fixes that depend on the catalog being reachable.
- **Adopt `react-hook-form` + `@hookform/resolvers/zod`** for the booking-request form. Same stack as the admin app (`apps/admin/src/features/bookings/components/BookingForm.tsx`). Promote the existing server-side zod schema for `/api/public/booking-requests` to a **shared module** that both the admin route handler and the homepage form import, so client and server agree on the input shape at compile time.
- **Phone validation is a permissive regex**, not `libphonenumber-js`. Shape check only; the server-side schema mirrors it. The accepted shape is `^\+?[0-9 .\/()-]{7,20}$` with placeholder text `+41 79 123 45 67`. (`libphonenumber-js` would over-reject legitimate Swiss customer inputs and accept alphanumeric vanity numbers like `555-SHOE`.)
- **Email validation is strict zod `.email()`** with the field marked `required`.
- **Form layout**: cap the form column at `max-w-[680px]`. Group "Your contact details" with name on its own row, email + phone side-by-side at `sm:` breakpoint. Keep the existing date/time 2-col row. Duration sits below in its own row, max width `~12ch`. Venue name + city become side-by-side at `sm:`. Services list stays full-width inside the form column. Mobile (<640px) stays single-column.
- **Submit-with-empty-catalog is allowed** when the customer fills in the "Anything else?" comment. This handles the legitimate case where the catalog is mid-update or the customer's need doesn't map cleanly to a listed service.
- **Validation errors are surfaced per-field on submit**, not as a single bottom-of-form message. The current `errorMessage` state remains for server/network errors only.
- **Nav and Hero on the homepage get a "Request booking" CTA.** The page was unreachable from the public site (it was only reachable via direct URL and from `/datenschutz`). Add to `Nav.tsx` and replace the hero `#contact` CTA with a real link to `/booking-request/`.
- **Manual smoke uses ff-rdp.** The customer-form end-to-end check (Nav → Hero → form → submit → success state) goes through `ff-rdp` per `CLAUDE.md`. Append a dogfooding session report at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md` covering what worked, bugs, quirks, improvement ideas.

## Pre-flight

- [ ] iter-30 merged on `main` and deployed *(soft dependency — iter-30's 5h-min decision in §scope.6 is the same business rule we surface here; if iter-30 ships first, this iteration only mirrors it on the customer side. If iter-31 ships first, document the 5h floor in the customer schema and the admin side picks it up in iter-30.)*
- [ ] No in-flight branches touching `apps/homepage/src/app/(site)/booking-request/`, `apps/admin/src/proxy.ts`, or `apps/admin/src/app/api/public/`.
- [ ] `npm run verify` green on `main`.

## Scope

### 1. Proxy: allow `/api/public/*`

`apps/admin/src/proxy.ts`. The `PUBLIC_PATH_RE` regex currently allowlists `/login`, `/set-password`, and `/api/auth`. The `/api/public/*` namespace was added in [iter-26](iteration-26-public-booking-request.md) but never added to the proxy — so every request to `/api/public/services` and `/api/public/booking-requests` 307-redirects to `/login` and the body of the response is `/login`. Verified against prod with `curl -sS -o - https://admin.wardrobe-assistants.ch/api/public/services` → `HTTP 307 /login`.

- **Fix**: extend `PUBLIC_PATH_RE` with `|api\/public(?:$|[\/?])`. Boundary-anchored so `/api/publicly-evil` cannot slip through.
- **Test**: add a unit test for the regex covering `/api/public/services`, `/api/public/booking-requests`, `/api/public` (root), `/api/public/`, and rejection of `/api/publicly-evil`.
- **Smoke**: extend the existing `public-services.smoke.test.ts` / `public-booking-requests.smoke.test.ts` to assert no proxy interference (the smoke tests bypass the proxy today by hitting handlers directly — add a route-level test that exercises the full middleware path).

### 2. Shared zod schema for `/api/public/booking-requests`

Promote the existing server-side input schema in `apps/admin/src/app/api/public/booking-requests/route.ts` (or wherever it lives — find it first) to a shared module. Two reasonable homes:

- `packages/shared/booking-request-schema.ts` — new package, future-proof if more shared schemas appear.
- `apps/admin/src/lib/public-schemas/booking-request.ts` + homepage imports from `@wardrobe-assistants/admin` via a workspace alias.

Pick the lighter option. The homepage is static-export only; pulling a single zod schema in is fine, but pulling all of admin's `lib/` is not. If the second option causes accidental over-import, fall back to a new shared package.

**Schema additions in this iteration:**
- `customerEmail: z.string().email()` (was likely already `z.string().min(1)`).
- `customerPhone: z.string().regex(/^\+?[0-9 .\/()-]{7,20}$/, "Please enter a phone number with at least 7 digits.")`.
- `durationHours: z.number().int().min(5, "Minimum duty is 5 hours.").max(24)`.
- `comment: z.string().max(2000).optional()`.
- **`refine`**: `serviceSelections.length > 0 || (comment != null && comment.trim().length > 0)`, with error `"Tell us which services you need, or describe your request in 'Anything else?'."`.

### 3. Form refactor with `react-hook-form`

`apps/homepage/src/app/(site)/booking-request/_form.tsx`. Replace the hand-rolled `useState` field collection with `useForm({ resolver: zodResolver(shared schema) })`. Keep the spam-defense state (`formLoadedAt`, `token`, `honeypot`) as plain `useState` — those aren't user-visible fields and shouldn't go through the form lifecycle.

- **Per-field error rendering** under each `<Field>` (component already exists; extend its props to accept `error?: string`).
- **Submit triggers full validation**; first invalid field receives focus.
- **Disable submit button** while submitting OR when `formState.isSubmitting`.
- **Service quantities** become a `Record<string, number>` registered as a single field; validation runs in the refine step from §2.

### 4. Duration input bug

Same file, lines ~285-302. The `onChange` handler does `Number(e.target.value)` which evaluates `Number("") === 0`, then `Math.max(5, 0) === 5` — so any attempt to clear the input snaps back to 5 instantly. Customers can't replace the value, only mutate it.

- **Fix**: store the duration in a `string` state during typing and coerce/clamp at submit (or on blur). With react-hook-form, register the field with `valueAsNumber: true` and a `setValueAs` that handles empty as `undefined`.
- **Test**: a vitest scenario that types into the duration input — clear, retype, submit. Must succeed.
- **Default value**: stay at `5` (the minimum), but show no value when the customer first clears the field.

### 5. Layout

Same file, plus its containing page. The form currently fills its parent's full column width. Constrain to a focused column:

- Cap the form at `max-w-[680px]` (matching the existing email-template width). Centre within the article.
- Inside the form:
  - Name on its own row.
  - Email + Phone side-by-side at `sm:` breakpoint.
  - Date + Start time already side-by-side at `sm:` — keep.
  - Duration on its own row, input narrowed to `~12ch`.
  - Venue name + City side-by-side at `sm:`.
- Services list and comment textarea stay full-width inside the form column.
- Submit button stays full-width on mobile, narrower (`sm:w-auto`) on desktop.
- Vitest-axe smoke for the form ensures no a11y regressions from the layout shuffle.

### 6. Helper copy

- **5h minimum hint** directly under the duration label: *"Minimum 5 hours."* — and as the zod error message. The existing paragraph at the bottom of the services fieldset stays (it explains *why*).
- **Phone hint**: placeholder `+41 79 123 45 67`.
- **Optional fields explicit**: rename "Anything else?" hint to *"Tell us anything that doesn't fit above — call times, dress code, parking, special requests."*.

### 7. Empty-catalog submit allowance

`_form.tsx:86-92` — current guard unconditionally blocks when `selectedSelections.length === 0`. Replaced by the schema-level refine in §2 (services-or-comment). Remove the in-handler guard.

When the catalog is empty AND no comment is set, the refine fires on submit with the focused error rendered next to the services list ("Tell us which services you need, or describe your request in 'Anything else?'.").

### 8. Homepage Nav and Hero CTA

The `/booking-request` page is currently reachable only via direct URL or from `/datenschutz` (FADP disclosure). Casual visitors don't know it exists.

- **Nav** (`apps/homepage/src/components/Nav.tsx:4-7`): add `{ label: "Request booking", href: "/booking-request/" }` between Services and Contact. Verify the CSS-only mobile menu still resets via the checkbox-hack (the comment in `Nav.tsx` notes that plain `<a>` must be used in the mobile menu items so the checkbox unchecks on full nav).
- **Hero CTA** (`apps/homepage/src/app/(site)/page.tsx:77`): change `<LinkButton href="#contact">Book the squad</LinkButton>` to `<LinkButton href="/booking-request/">Request a booking</LinkButton>`. Keep the `#contact` mailto fallback that exists later on the page.
- **Sitemap / robots** unchanged — `/booking-request` is already crawlable.

## Out of scope

- Customer login or account creation. Booking-request stays unauthenticated.
- Real-time service catalog (websocket / on-page fetch). Build-time SSG snapshot is the [iter-26](iteration-26-public-booking-request.md) decision and stays.
- German translation.
- Customer-visible offer-token retrieval (the customer already gets the offer URL via email; no "look up my offer" page).
- Cookie consent / GDPR banner work. Unchanged.

## Done when

- [ ] `curl -sS -o /dev/null -w "%{http_code}\n" https://admin.wardrobe-assistants.ch/api/public/services` returns `200` (not `307`). Same for `POST /api/public/booking-requests` with a valid payload.
- [ ] The next homepage build pulls a non-empty service catalog (verified by `grep -c '"id"' apps/homepage/.next/.../<built-page>` in CI, or by visual inspection on preview).
- [ ] `apps/homepage/src/app/(site)/booking-request/_form.tsx` uses `react-hook-form` + `zodResolver(sharedBookingRequestSchema)`.
- [ ] Per-field validation errors render on submit; first invalid field is focused.
- [ ] Duration input accepts empty intermediate state; clear-and-retype works.
- [ ] Customer can submit without any service selection when the "Anything else?" field is non-empty.
- [ ] Customer cannot submit with neither service selections nor a comment — schema refine fires with the correct message.
- [ ] Form fits within `max-w-[680px]`; email/phone, date/time, and venue/city pair side-by-side at `sm:` breakpoint; everything stacks on mobile.
- [ ] Phone field accepts `+41 79 123 45 67`, `079 123 45 67`, `+41-44-555-1234`, `044/555 12 34`; rejects `abc`, `555-SHOE`, `1`.
- [ ] Email field rejects malformed strings with a per-field error.
- [ ] 5h minimum is enforced at the schema level and surfaced as a helper hint under the duration label.
- [ ] Nav has a "Request booking" link; Hero CTA links to `/booking-request/`.
- [ ] Vitest-axe smoke covers the form in its empty, error, and success states.
- [ ] `npm run format` clean; `npm run verify` green.
- [ ] Manual smoke on a preview deploy: visit homepage → click hero CTA → land on `/booking-request` → catalog renders → fill form with invalid email → submit → email field shows error → fix → submit → success state with confirmation copy → admin push + email arrive → admin opens new booking from `/bookings?status=new-requests`.

## Heads-up for follow-ups

1. **Build-time fetch is still fragile.** `fetchServices` in `page.tsx` falls back to an empty array on any failure (network, timeout, 5xx). With §1 the auth issue goes away, but the homepage build still depends on the admin app being reachable at build time. If the admin is mid-deploy when the homepage rebuilds, the catalog snapshot could land empty. A future iteration could: (a) cache the last-known-good snapshot in the homepage repo, (b) fail the homepage build instead of silently falling back, or (c) refetch on the client after hydration. For v1, the current fallback + the bottom-of-services paragraph mentioning email is acceptable.
2. **The shared zod schema unblocks more sharing.** Once the booking-request schema is in a shared module, the admin's `BookingForm` could potentially import the same constraints (5h floor, phone regex, etc.) so the admin and customer forms stay aligned automatically. iter-30 introduces the same business rules on the admin side — see the iter-30 Pickup list. Consolidation work for a follow-up iteration.
3. **`max-w-[680px]` is a homepage-form-specific choice.** No design-system token for it. If more forms appear, promote to `--form-column-max` in the design-token CSS so the constraint is named, not magic-numbered.
4. **The submit button's full-width-on-mobile pattern** is duplicated in admin's `BookingForm`. If a third form appears, factor a `<SubmitButton>` UI primitive.
