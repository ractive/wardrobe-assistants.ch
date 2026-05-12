---
title: Iteration 39 — Squad-member surface bugs + auth onboarding fixes
type: iteration
order: 40
status: implemented
---

# Iteration 39 — Squad-member surface bugs + auth onboarding fixes

Ship the high-priority items from `kb/Notes.md` that are either **outright broken** (squad-member can't confirm bookings, ChunkLoadError, Manifest syntax error, admin missing /my-bookings link) or **block onboarding** (invitation email is confusingly framed as a password reset, 12-char password minimum is unusually strict, password-set rate limit fires on first try after invite).

Implemented autonomously by `/ralph-loop` where possible; some squad-member bugs need browser repro before scope is fully knowable, so §A items must each be opened with a short "diagnosis" entry before the fix lands. The iteration must leave the system fully working at the boundary.

## Decisions

- **Squad-member bugs land before auth-onboarding fixes.** §A items are functional regressions (the app doesn't work for a whole role); §B is friction. Order matters because §A may reshape the navigation surface, which §B doesn't touch.
- **Diagnose before scoping each §A item.** The Notes.md entries are bug reports, not specs. Open each scope item with a "Repro + root cause" sub-section (1–3 lines) before listing the fix. Use `ff-rdp` against the deployed admin where appropriate (the user has `james+squadmember@ractive.ch` for this).
- **Password length floor matches industry common — 8.** NIST 800-63B allows ≥8 for user-chosen passwords when paired with breach checks and rate limits, which we already have. 12 has been costing real onboarding friction. Keep `min(8)` in both `apps/admin/src/lib/auth.ts` (`minPasswordLength`) and the zod schemas (login form, set-password form, signup schema) — they must stay in sync.
- **Rate-limit posture: split "initial set-password" from "forgot-password".** The current `passwordReset: { limit: 3, windowMs: 60 * 60 * 1000 }` bucket fires when a freshly-invited user triggers a single retry. Two clean options — pick one:
  - **Option A** (smaller change): raise `passwordReset` to `{ limit: 5, windowMs: 15 * 60 * 1000 }`. Same protection class, more forgiving on legitimate retry.
  - **Option B** (right modeling): introduce a separate bucket `setInitialPassword` keyed on the invitation token (single-shot, no email-based throttle since the token is the rate-limit boundary), leave `passwordReset` alone.
  Default to **A** for this iteration; queue B as iter-39b if A still bites.
- **Invitation copy is a template fork, not a flag.** Don't reuse `passwordReset.tsx` with conditional copy — it makes the template harder to read and reason about. Create `apps/admin/src/lib/email-templates/welcome-invite.tsx` and route the invitation path through it; keep the existing `passwordReset.tsx` for genuine forgot-password flows. Both templates can share `_cta.tsx` for the button.
- **Sidebar visibility for `/my-bookings` + `/upcoming-bookings`**: show to *everyone* (admins included), not just squad members. The current squad-only gate is a leftover from when the dashboard hadn't been built — admins also have bookings they're personally on, and "View bookings the system thinks are yours" is useful regardless of role. No permission-catalog change needed (these routes are already auth-only).
- **`ff-rdp` dogfooding** report appended at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md`. This iteration is heavy on browser repro — make the report substantive.

## Pre-flight [4/4]

- [x] iter-38 merged on `main` (commit `d2b4b50`); the recent CDN + auth-response fixes (`d60b40e`, `9da5df8`) landed.
- [x] `npm run verify` green on this iteration's branch base.
- [x] No in-flight branches touching `apps/admin/src/components/DashboardSidebar.tsx`, `apps/admin/src/app/(dashboard)/my-bookings/`, `apps/admin/src/app/(dashboard)/upcoming-bookings/`, `apps/admin/src/lib/auth.ts`, `apps/admin/src/lib/rate-limit.ts`, `apps/admin/src/lib/email-templates/`, or the schema zod files.
- [x] Confirm the squad-member account `james+squadmember@ractive.ch` is still usable (post-merge of `d60b40e`).

## Scope

### A. Squad-member surface bugs (4 items)

Each item: open with a 1–3 line repro + root cause before listing the fix. Use ff-rdp + the squad-member account for repro.

1. **Clicking a booking on the squad-member bookings list does nothing.** Expected: open the booking detail page. Repro path: log in as squad member → /bookings (or whichever list the squad sees) → click a row. Likely culprit: `BookingsTable` whole-row Link landed in iter-37 §B.1 but may be permission-gated or path-divergent for the squad-member route (`/my-bookings`?). Fix the click to navigate to the booking detail.

2. **Squad-member booking detail page must support confirm / reject / cancel.** Per the original audit, squad members can take participation actions but the action surface is admin-only currently. Add the squad-member equivalents (`requestParticipation` already exists; surface accept/withdraw on the detail page when the booking has an outstanding assignment for this user). Check `apps/admin/src/features/bookings/components/AssignmentInvite*.tsx` — this component family is the right place per iter-37 §E.

3. **`ChunkLoadError` on squad confirm.** The Notes.md trace points at `_next/static/chunks/0v8kbtk91gogw.js` failing to load. Likely a stale-bundle / deploy-skew issue (browser cached an old chunk reference, new deploy renamed the chunk). Action: confirm by checking whether `Cache-Control` headers on the chunks are correct, and whether the service worker is serving stale chunks. If SW is the cause, ensure the SW's update flow is correct (iter-23 set `updateViaCache: "none"` — verify it's effective). If not, this likely fixes itself with the next deploy; document the diagnosis either way.

4. **`Manifest: Line: 1, column: 1, Syntax` error in console when squad member clicks "My Bookings" / "Upcoming Bookings".** The manifest URL is `/site.webmanifest` or `/manifest.json` (iter-23 PWA work). Likely the server returns HTML (a redirect to /login through `proxy.ts`'s auth gate) instead of the JSON manifest because the request lacks a session cookie. Fix: add the manifest path to `PUBLIC_PATH_RE` in `apps/admin/src/proxy.ts` so it's served without auth, or set `cache-control` appropriately. Verify with a curl probe.

### B. Sidebar nav surface (1 item)

1. **`My Bookings` + `Upcoming Bookings` visible to admins too.** `apps/admin/src/components/DashboardSidebar.tsx` currently gates these on the squad-member role; remove the gate so admins see them as well. Both routes are already auth-only (no role-derived data leak); the existing `/my-bookings` query keys on `userId`, so an admin sees only their own. No permission catalog change.

### C. Auth onboarding (3 items)

1. **Reduce password floor from 12 → 8.** Update in lockstep:
   - `apps/admin/src/lib/auth.ts:41` — `minPasswordLength: 8`.
   - Every zod schema with a `min(12)` on a password field (login, set-password, signup). Grep `min(12)` in `apps/admin/` to find them.
   - Form copy: drop "Use at least 12 characters" → "Use at least 8 characters."
   - Update the existing vitest tests that assert the 12-char boundary (they'll be at the schema and form-action layers).

2. **Invitation email: "welcome / activate", not "reset password".** Create `apps/admin/src/lib/email-templates/welcome-invite.tsx` (clone the structure of `passwordReset.tsx`, change copy: subject "Welcome to Wardrobe Assistants — activate your account", body explains the user was invited and the CTA is "Activate your account"). Add a `welcomeInvite` entry to the templates registry in `apps/admin/src/lib/email-templates/index.ts`. Route the invitation flow (find it in `apps/admin/src/features/users/server/actions.ts` — the `inviteUser` action or equivalent) through the new template; leave `passwordReset.tsx` exclusively for the forgot-password flow. Add the templates.test.tsx case for `welcomeInvite`.

3. **Loosen the password-set rate limit (Option A from Decisions).** `apps/admin/src/lib/rate-limit.ts:94` — change `passwordReset` from `{ limit: 3, windowMs: 60 * 60 * 1000 }` to `{ limit: 5, windowMs: 15 * 60 * 1000 }`. Update the matching test in `apps/admin/src/test/security.smoke.test.ts` (search for `passwordReset`). The new shape is a tighter window with a higher hit-count; equivalent protection against bulk reset-spam, but a legitimate first-attempt retry won't get caught.

## Done when [10/10]

- [x] §A.1–§A.4 each have a one-paragraph "Repro + root cause" in the PR description (or the commit body), even if the fix is one line. (Captured in the iter-39 commit body `2b85da3`.)
- [x] Squad member can navigate from a list row to the detail page and accept/decline their assignment without errors. (§A.1 fix closes §A.2 — the action surface already existed; only the row-click navigation was missing.)
- [x] No ChunkLoadError on a fresh load of the squad-member booking confirm path. Documented as deploy-skew: admin SW is push-only with no fetch handler and `updateViaCache: "none"` is set, so a one-shot stale-bundle reference resolves on next hard refresh. No code change.
- [x] No Manifest syntax error in the console when clicking /my-bookings or /upcoming-bookings as a squad member.
- [x] Admin user sees "My Bookings" + "Upcoming Bookings" sidebar links.
- [x] Setting a password with 8 chars succeeds; setting with 7 chars fails with a clear message.
- [x] First-time invitee receives an email titled along the lines of "Welcome — activate your account", containing an "Activate your account" CTA, not "Reset your password". Existing forgot-password flow still ships the old template, unchanged.
- [x] An invitee can retry their password-set at least 4 times in a 15-minute window without hitting 429.
- [x] `npm run verify` green (lint + typecheck + 494 tests). New tests cover the welcome-invite template, the rate-limit window change, and the 8-char password boundary.
- [x] `ff-rdp` dogfooding session appended (`../ff-rdp/kb/dogfooding/dogfooding-session-43.md`).

## Out of scope

- Stored-notification bell badge (Notes.md item under "Idea") — exploratory, queued separately as iter-40 §D.
- Invoice integration (`abaninja.ch`) — iter-22 covers, still deferred.
- "..." menu → icons on /users + /services — UI polish, iter-40 §B.
- Table component abstraction across /bookings, /services, /users — exploratory, iter-40 §E.
- Server-side log expansion — iter-40 §F.
