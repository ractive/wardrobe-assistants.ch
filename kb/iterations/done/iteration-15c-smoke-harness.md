---
title: Iteration 15c — Local-dev smoke harness + feature-slice template
type: iteration
order: 16.7
status: done
---

# Iteration 15c — Local-dev smoke harness + feature-slice template

Before iter-16/17/18 add three vertical-slice features in a row, we need a way to verify each slice end-to-end **before** push. iter-15b's BETTER_AUTH_SECRET surprise proved that "vitest green + `next build` green" is not the same as "the auth + DB + permissions path actually works against the real schema" — and iter-15's existing per-feature tests stop at server actions, not at the HTTP boundary.

This iteration adds a thin HTTP-level smoke harness (vitest, no Playwright) and writes down the convention every future feature slice will follow.

## Context — why now

- iter-16/17/18 plans all say "Conventions inherited from iter-15", but the convention is currently implicit (read iter-15's `features/users/`, copy). A short written reference saves three repeated archeology passes and locks the shape so it doesn't drift.
- The test gap is *integration* — i.e. "run the auth API against the real Drizzle schema and a real libSQL DB and confirm it doesn't 500". Unit tests against an actions module mock too much; `next build` doesn't run code at all. Playwright would close this gap but is overkill at one developer + small feature surface.
- `db:reset:admin` already gives a one-shot local bootstrap (.env.local synthesis, schema, seeded admin). Smoke needs to layer on top of that, not duplicate it.

## Scope — HTTP smoke harness [4/4]

- [x] Add `apps/admin/src/test/http-harness.ts` exporting helpers that spin up tmp libSQL + real auth + signUpAndSignIn / seedAdmin / seedSquadMember + a `runAs(cookies, fn)` helper for next/headers-mocked permission tests.
- [x] Add `apps/admin/src/test/http-harness.test.ts` to self-test the harness — 5 cases including round-trip session + role assertions on user_profile.
- [x] Convention adopted: smoke tests live next to the feature as `*.smoke.test.ts`.
- [x] First example: `apps/admin/src/features/users/server/users.smoke.test.ts` covering invite + list + role-gated delete (squad member denied, admin succeeds, self-delete rejected).

## Scope — feature-slice template doc [3/3]

- [x] Create `kb/admin-architecture/feature-slice-template.md` describing the slice shape — folder layout, Drizzle/Zod/permissions/UI conventions, the three-test triad with code snippets, the per-iteration manual smoke checklist, common pitfalls.
- [x] Cross-link from `kb/admin-architecture/overview.md` (added a "Start here" row pointing at the template).
- [x] Update `CLAUDE.md`'s admin-app section to point at the new template + flag smoke tests as mandatory.

## Scope — npm scripts + ergonomics [2/2]

- [x] Add `apps/admin/package.json` script `test:smoke` filtering by name pattern; runs ~9 tests in &lt;2s.
- [x] `npm run verify` already runs every `*.test.ts` under the admin project, so smoke tests are already gated in CI without further wiring.

## Verify [3/3]

- [x] `npm run verify` — green; 12 test files / 80 tests pass.
- [x] `kb/admin-architecture/feature-slice-template.md` exists, links from overview + CLAUDE.md, and is a complete copy/paste reference.
- [x] `apps/admin/src/features/users/server/users.smoke.test.ts` runs against the real `runMigrations()` schema. **The harness already earned its keep:** it caught a real iter-15 bug — `databaseHooks.session.create.before` returning `role`/`firstName` to fields the session table didn't have, silently dropped, leaving `session.user.role` permanently undefined. Every withPermission gate would have 401'd in prod the moment a permission-gated action was clicked. Fixed in this iteration by reading role from `user_profile` at permission-check time via `roleForUserId(userId)`.

## Out of scope (deliberate)

- **Playwright / real browser e2e.** Reserved for when feature flows get complex enough that ad-hoc ff-rdp clicks aren't sustainable. Today's surface is too small to justify the dep + flake budget.
- **CI smoke against a remote libSQL.** The smoke layer is local-only — it tests our code's contract with the schema, not bunny.net's runtime. Prod-shape verification stays the seed-temp-admin + ff-rdp path.
- **Test-data fixtures or factories.** Build only what the first smoke test needs. A factory pattern can grow organically when the second feature copies the first and the duplication itches.
- **Feature scaffolding generator.** A doc reference is enough; a Plop-style generator costs more to maintain than it saves at this scale.

## Critical files

New:
- `apps/admin/src/test/http-harness.ts`
- `apps/admin/src/test/http-harness.test.ts`
- `apps/admin/src/features/users/server/users.smoke.test.ts`
- `kb/admin-architecture/feature-slice-template.md`

Edited:
- `apps/admin/package.json` (`test:smoke` script)
- `package.json` (verify chain pulls in smoke)
- `kb/admin-architecture/overview.md` (cross-link)
- `CLAUDE.md` (point at the template)

## Done when [4/4]

- [x] Future iteration plans can say "follow the feature-slice template" and that's a complete instruction.
- [x] First feature (users) lands with a `*.smoke.test.ts` exercising the auth + permission + schema path against a real libSQL. iter-16+ inherit this requirement via the template + this iteration's "Done when".
- [x] An iter-15b-class breakage (env or schema mismatch) now fails CI on the PR rather than at prod smoke. Proven by the iter-15 role-bug catch.
- [x] The per-iteration manual smoke checklist is documented in `feature-slice-template.md`'s "Per-iteration smoke checklist" section; iter-16+ copy it into their `Verify` blocks.

## Surprise found during implementation

The smoke harness immediately caught a real iter-15 auth bug: the `databaseHooks.session.create.before` hook merged `role`/`firstName`/etc. into the session payload, but Better Auth's session schema had no columns for them — the data was silently dropped. `session.user.role` was never populated, and any `withPermission` check would have 401'd in prod the moment someone clicked a permission-gated action.

Fix folded into this iteration:
- Removed the broken write-time hook + `additionalFields` declaration on user.
- Added `roleForUserId(userId)` in `lib/auth.ts` that queries `user_profile` directly.
- `withPermission` and `getCurrentUserRole` now route through it.
- One extra DB read per permission-checked request — acceptable on the admin surface, can add request-scoped caching later.

This is exactly the class of bug iter-15c was supposed to catch. The harness paid for itself before merging.
