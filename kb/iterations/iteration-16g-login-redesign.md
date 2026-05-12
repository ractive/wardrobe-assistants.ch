---
title: Iteration 16g — Login redesign + load-bearing component tests
type: iteration
order: 17.8
status: done
---

# Iteration 16g — Login redesign + load-bearing component tests

The first **redesign** in the post-iter-16 hardening sequence. Per the user's rule: redesigns only happen *after* the design system is defined (iter-16c) and the existing UI is cleaned up (iter-16d/e). The login page is the highest-leverage redesign target — it bypasses every shadcn primitive (raw `<input>`/`<button>`, no `<Form>`, hand-rolled error display, no focus management on step transition) and it's the surface that *every* admin sees before doing anything.

Pairs with the load-bearing component tests (LoginPage, EventForm, AssigneesPicker) since the redesigned login page is one of the three; doing them together means the test convention covers the surfaces that matter most.

Mobile responsiveness applied per design-system doc.

## Pre-flight

- [x] iter-16c (design system) merged. `design-system/README.md` defines exactly how forms look on mobile/desktop.
- [x] iter-16d (nav + data cleanup) merged.
- [x] iter-16e (forms + boundaries) merged. `useFormAction()` exists; `role="alert"` already wraps server-error spans on login + set-password.
- [x] iter-16f (defense-in-depth) merged. Brings: password floor 12 (`login-schema.ts` + Better Auth `minPasswordLength`), set-password hint copy ("Use a passphrase you don't reuse — at least 12 characters"), rate-limit on auth POSTs (5/15min login per IP+email, 3/h reset per email, 3/h signup per IP) returning HTTP 429 + `Retry-After`. The redesign must preserve the 12-char min message text and gracefully surface the new 429 path (toast via `useFormAction` is already wired; verify the rate-limit message reads sensibly).
- [ ] **Block before iter-19 (auth-mfa)** — iter-19 will extend MFA logic and benefits from the cleaner step structure landing first. _(Forward-looking constraint, not a deliverable; remains a tracked invariant.)_

## Scope — login page redesign [4/5]

Closes **F-FE-01**, **F-FE-11**, **F-FE-26**. The remaining live-region work (F-FE-02) was applied in iter-16e without redesign; this iteration replaces the surrounding UI.

- [x] Migrate `apps/admin/src/app/login/page.tsx` to use shadcn `<Form>`+`<FormField>`+`<FormControl>`+`<FormMessage>`+`<Input>`+`<Button>`. Drop the raw inputs at lines 78, 92, 124. Field labels properly associated; field-level errors rendered via `<FormMessage>`. The `role="alert"` form-level region from iter-16e stays.
- [x] Extract the credentials and TOTP flows into `apps/admin/src/app/login/credentials-step.tsx` and `totp-step.tsx` client components. The page becomes a coordinator (~50 lines) holding the `step` state and forwarding callbacks.
- [x] On step transition (`step === "totp"`), move focus to the TOTP input via `useEffect` + `ref.focus()`. Closes **F-FE-11**.
- [x] Apply DS form layout: full-width inputs on mobile, two-column grid `md:grid-cols-2` is overkill here (auth has one field per row), so leave single column but full-width with comfortable spacing. Submit button full-width on mobile, auto-width on desktop.
- [ ] Manual desktop + 375px mobile smoke: keyboard-only flow works end-to-end; focus visible on every step; `Cmd+Enter` (or just `Enter`) submits the active step; SR announces field errors and step transition. _(Automated keyboard tab-order + focus-on-TOTP tests landed in `login.test.tsx`; bona-fide cross-viewport manual smoke is not verifiable from the diff and remains user-driven.)_

## Scope — load-bearing component tests [4/4]

Closes **F-FE-09** (`*.test.tsx` count = 0). Picks the three highest-leverage components.

- [x] `apps/admin/src/app/login/login.test.tsx` — render the redesigned login page; happy path (valid credentials → step transition → focus on TOTP); error path (invalid credentials → `role="alert"` announced); keyboard tab order; axe-clean.
- [x] `apps/admin/src/features/events/components/EventForm.test.tsx` — required-field validation; date picker open + select; successful submit calls the action with parsed input; server error renders in form-level region; axe-clean. Mock `useFormAction()` boundary.
- [x] `apps/admin/src/features/events/components/AssigneesPicker.test.tsx` — open the picker; type-to-search filters list; selecting a candidate calls assign action via `useTransition`; assigned user disappears from the list and appears in assignees row; remove fires the unassign action; axe-clean.
- [x] Update `kb/admin-architecture/feature-slice-template.md`: cite these as the canonical "what a feature's component test looks like" examples.

## Scope — mobile-responsive auth flow polish [1/2]

Closes the remaining mobile gaps on the auth surfaces. Touches files already being edited above.

- [x] Login + set-password: page padding `px-4 py-8 md:py-12`; container `max-w-md mx-auto`; touch targets ≥ 44px on inputs and submit; sticky/full-width submit on mobile if helpful.
- [ ] Manual smoke at 375px: every step usable single-handed; no horizontal scroll; back-button behavior sane. _(Manual cross-viewport smoke not verifiable from the diff; remains user-driven.)_

## Verify [3/6]

- [x] `npm run verify` — green.
- [x] All three load-bearing component tests are green; vitest-axe assertions all pass.
- [ ] Manual desktop: full login flow (credentials → TOTP) works keyboard-only; submit-on-Enter works on each step. _(Tab-order is automated in `login.test.tsx`; live keyboard-only smoke remains user-driven.)_
- [ ] Manual mobile (375px): same flow works thumb-only; focus moves to TOTP input on transition; SR announces field errors and the step transition. _(Focus-on-TOTP is automated; live mobile smoke remains user-driven.)_
- [x] No regressions on set-password page (still uses the iter-16e `role="alert"` region; no redesign needed there). _(`apps/admin/src/app/set-password/**` not touched in this PR.)_
- [ ] Manual: trigger the iter-16f rate limiter on login (≥6 bad-credential attempts within 15min) and verify the 429 surfaces as a sensible toast, not a raw error. _(Rate-limit surface lives in iter-16f; not exercised in code by this PR.)_

## Out of scope (deliberate)

- **Set-password redesign.** Already used shadcn primitives before this iteration; iter-16e added the live region. No further work needed unless iter-19 (auth-mfa) opens it back up.
- **Sign-up flow.** No public sign-up surface today. Re-enter scope only if Better Auth's signup is exposed.
- **Magic-link / passkey / passwordless.** Out of scope; would be a separate auth iter.
- **Adding more component tests.** Three is the convention-establishing set; iter-17/18/19 add more per the feature-slice template.
- **i18n on auth strings.** Out of scope.

## Critical files

New:
- `apps/admin/src/app/login/credentials-step.tsx`
- `apps/admin/src/app/login/totp-step.tsx`
- `apps/admin/src/app/login/login.test.tsx`
- `apps/admin/src/features/events/components/EventForm.test.tsx`
- `apps/admin/src/features/events/components/AssigneesPicker.test.tsx`

Edited:
- `apps/admin/src/app/login/page.tsx` — coordinator; raw inputs/buttons removed
- `kb/admin-architecture/feature-slice-template.md` — cite test examples

## Done when [3/4]

- [x] Login page uses shadcn `<Form>`/`<Input>`/`<Button>` exclusively; no raw `<input>` or `<button>` anywhere on the auth surface.
- [x] Credentials and TOTP are sub-components; focus moves to TOTP input on step transition; SR announces the change.
- [x] Three load-bearing component tests with vitest-axe are green.
- [ ] Mobile 375px-width keyboard-only flow works end-to-end; iter-19 (auth-mfa) will inherit the cleaner structure. _(Manual cross-viewport smoke not verifiable from the diff; remains user-driven.)_
