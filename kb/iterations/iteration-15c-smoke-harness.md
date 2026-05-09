---
title: Iteration 15c — Local-dev smoke harness + feature-slice template
type: iteration
order: 16.7
status: planned
---

# Iteration 15c — Local-dev smoke harness + feature-slice template

Before iter-16/17/18 add three vertical-slice features in a row, we need a way to verify each slice end-to-end **before** push. iter-15b's BETTER_AUTH_SECRET surprise proved that "vitest green + `next build` green" is not the same as "the auth + DB + permissions path actually works against the real schema" — and iter-15's existing per-feature tests stop at server actions, not at the HTTP boundary.

This iteration adds a thin HTTP-level smoke harness (vitest, no Playwright) and writes down the convention every future feature slice will follow.

## Context — why now

- iter-16/17/18 plans all say "Conventions inherited from iter-15", but the convention is currently implicit (read iter-15's `features/users/`, copy). A short written reference saves three repeated archeology passes and locks the shape so it doesn't drift.
- The test gap is *integration* — i.e. "run the auth API against the real Drizzle schema and a real libSQL DB and confirm it doesn't 500". Unit tests against an actions module mock too much; `next build` doesn't run code at all. Playwright would close this gap but is overkill at one developer + small feature surface.
- `db:reset:admin` already gives a one-shot local bootstrap (.env.local synthesis, schema, seeded admin). Smoke needs to layer on top of that, not duplicate it.

## Scope — HTTP smoke harness [0/4]

- [ ] Add `apps/admin/src/test/http-harness.ts` exporting helpers that:
  - Spin up an in-process libSQL file in `tmpdir()`, run `runMigrations()` against it.
  - Initialise a fresh `auth` instance against that DB (or reuse the singleton with `vi.stubEnv` swapping `DATABASE_URL`).
  - Provide `signUpAndSignIn(email, password)` returning a `Headers` object pre-populated with the auth cookie, plus a `db` handle for direct schema reads.
  - `seedAdmin({ email, password })` and `seedSquadMember({ email, password })` for permission tests.
- [ ] Add `apps/admin/src/test/http-harness.test.ts` to self-test the harness — proves sign-up + sign-in actually round-trip against the schema. If this test ever 500s, every feature smoke breaks the same way at the same line.
- [ ] Convention: smoke tests live next to the feature as `*.smoke.test.ts`. Vitest's existing `*.test.ts` glob already picks them up; the suffix is a signal to the reader, not a separate runner.
- [ ] First example: `apps/admin/src/features/users/server/users.smoke.test.ts` covering the iter-15 paths — invite, list, role-gated delete (401 as squad member, 200 as admin). Used as the canonical reference future features copy.

## Scope — feature-slice template doc [0/3]

- [ ] Create `kb/admin-architecture/feature-slice-template.md` describing the slice shape iter-15 established:
  - Folder layout (`schema.ts` / `schema.test.ts` / `server/queries.ts` / `server/actions.ts` / `server/actions.test.ts` / `components/*`).
  - Schema convention (Drizzle table + migrations dir).
  - Server actions convention (Zod parse → permission gate → query → revalidate path).
  - Permission catalog entry + `HasPermission` / `useHasPermission` gating points.
  - Test triad: schema test (Zod boundaries), action test (mocked DB), smoke test (real DB, HTTP layer).
  - **Per-iteration smoke checklist** — a 5–10 line markdown stub each iteration appends to its plan: "boot `npm run dev:admin`, sign in as the seeded dev admin, create one of <X>, see it in the list, sign out". Forces a manual UI pass before merge but takes 60s.
- [ ] Cross-link from `kb/admin-architecture/overview.md` so the existing entry-point pulls newcomers (and future me) into the template.
- [ ] Update `CLAUDE.md`'s admin-app section to point at the new template doc as the canonical "this is how a feature looks" reference.

## Scope — npm scripts + ergonomics [0/2]

- [ ] Add `apps/admin/package.json` script `test:smoke` that runs only `*.smoke.test.ts`. Keeps the fast feedback loop (`npm run test`) fast — smoke tests open a libSQL file each run, ~50ms each but they add up.
- [ ] Wire `test:smoke` into `npm run verify` so the gate that's already enforced in CI also covers the integration path. Acceptable cost: maybe 1–3 seconds added to verify.

## Verify [0/3]

- [ ] `npm run verify` — green, including the new smoke tests.
- [ ] `kb/admin-architecture/feature-slice-template.md` exists, links from overview, and reads as a complete copy/paste reference (a teammate could implement iter-16 with no extra archeology).
- [ ] `apps/admin/src/features/users/server/users.smoke.test.ts` runs against the real `runMigrations()` schema and exercises at least one role-gated path. If `user_profile` or any iter-14+ migration is missing, this test 500s — turning the iter-15b class of bug into a PR-time failure.

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

## Done when [0/4]

- [ ] Future iteration plans can say "follow the feature-slice template" and that's a complete instruction.
- [ ] Each new feature lands with at least one `*.smoke.test.ts` exercising the auth + permission + schema path against a real libSQL.
- [ ] An iter-15b-class breakage (env or schema mismatch) fails CI on the PR rather than at prod smoke.
- [ ] The per-iteration manual smoke checklist is part of every future iteration plan's "Verify" section.
