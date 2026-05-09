---
title: Iteration 15b — Automate DB migrations on deploy
type: iteration
order: 16.5
status: implemented
---

# Iteration 15b — Automate DB migrations on deploy + get admin live

The current model from iter-09 is operator-driven: migrations are applied by hand from a workstation before each release that needs them. This iteration lifts that step out of the operator's hands so a deploy that introduces a schema change can never reach production code without the matching schema applied.

**Primary goal: the admin app is up and running on prod end-to-end.** Today `/api/auth/*` returns 500 because iter-14's `user_profile` migration was never applied. Iter-15b's first deploy must auto-apply that pending migration via the boot-time migrator, with verification going beyond a curl 200 — successful sign-in flow tested in a real browser via `ff-rdp` proves the runtime path is fully wired.

## Context — why now

Iter-15's deploy left prod with a missing `user_profile` table (iter-14's migration was never applied). The 500-on-`/api/auth/*` symptom was diagnosed at the iter-15 release smoke-test in this session. Iter-15's pre-flight checkbox claimed the migration was applied, but verification was implicit, not enforced. We need a mechanism that **fails the deploy** if the migration didn't run, so this can't reoccur.

Historical attempt to remember (iter-09):

> The Dockerfile originally ran `node --import tsx apps/admin/scripts/migrate.ts && node apps/admin/server.js` at boot. tsx couldn't resolve `@libsql/client` and `drizzle-orm` from the standalone runner image (Next's standalone bundle contains a minimal node_modules tree under `apps/admin/.next/standalone/node_modules`, not at `/app/node_modules`). The fix dropped migrations from the CMD; operators now run `npm -w apps/admin run migrate` from a workstation with `DATABASE_URL` + `DATABASE_AUTH_TOKEN` in env.

So whatever we do, it must work **inside the standalone bundle's node_modules tree**, not assume top-level deps.

## Feasibility comparison — three approaches

| Aspect | (1) CI step before container roll | (2) Dockerfile CMD (`migrate && server.js`) | (3) Next.js `instrumentation.ts` register hook |
|---|---|---|---|
| Mechanism | Workflow YAML step runs `npm run migrate` against prod DB after image push, before `BunnyWay/actions/container-update-image` | Container CMD wraps server boot in a migrate call | Next 16 calls `register()` once on server boot, before serving requests |
| Self-contained | No — splits responsibility between CI + runtime | Yes — image carries its own migration logic | Yes — same as (2), via a different entry point |
| Past attempt? | Never tried | iter-09 tried, gave up due to standalone bundle resolution issues | Never tried |
| Bundling problems | None (CI runner is full Node + npm) | Significant — requires bundling `tsx` + `drizzle-orm` + `@libsql/client` reachable to the CMD wrapper | Manageable — Next bundles imported code into standalone; we just need `packages/db/migrations` SQL files copied in |
| New GH secret? | Yes — `DATABASE_AUTH_TOKEN_FULL` (read-write) | No | No |
| Failure semantics | Workflow fails → no container roll → old code keeps running on old schema | New pod crash-loops → old pod stays up via Bunny replica behaviour (single replica today; behaviour unverified) | Same as (2) — pod boot fails before serving |
| Multi-replica safety | Race-free (single CI runner) | Replicas race on migration lock | Replicas race on migration lock |
| Cold-start cost | None (runs once in CI) | Adds ~1–3s to every container boot | Same as (2) |
| Independent rollback | Yes — can roll back image without touching schema, or vice versa | No — schema and image lifecycle coupled | No — same as (2) |
| Existing infra reuse | Need new workflow step + secret | Need to fix iter-09's bundling problem | `apps/admin/scripts/migrate.ts` already does the work; just refactor for re-use |

### Recommendation — option 3 (instrumentation hook)

Picking option 3 because:

- **Existing code reuse.** `apps/admin/scripts/migrate.ts` already contains the entire migrate flow — env loading, libSQL client construction, candidate-path resolution for the migrations folder, calling Drizzle's `migrate()`. The script even has a comment anticipating "in the standalone Docker image we copy `packages/db/migrations` next to it." We just refactor the script's body into an exported function and call it from `instrumentation.ts`.
- **No new secret.** Runtime env already contains `DATABASE_URL` + `DATABASE_AUTH_TOKEN`. CI never sees these.
- **Standalone-bundle-friendly.** Unlike iter-09's CMD approach, `instrumentation.ts` runs **inside** the Next.js standalone server process. `await import("./lib/migrate")` resolves through the standalone bundle's own node_modules tree — exactly where iter-09 failed.
- **Single-replica today.** `infra/terraform/containers.tf` sets `regions_max_allowed = 1`. No leader election needed yet; document the constraint and the upgrade path (advisory lock or external coordinator) if we ever scale.
- **Failure semantics are the right shape.** A migration error crashes the pod → Bunny restarts → keeps crashing → operator sees a failed deploy. Old replica stays serving while the new one fails — same shape as any other boot-time runtime check (e.g. iter-13's env tripwires).

Option 1 (CI step) is the obvious **fallback** if anything blocks option 3 — its mechanics are well understood and we already have the secret-naming convention from iter-12 (`_FULL` / `_READONLY`).

## Pre-flight [4/4]

- [x] **Bump Next.js to the latest 16.x in `apps/admin` and `apps/homepage`** before doing the standalone-hook spike. Currently pinned at `16.2.4` in both `apps/admin/package.json` and `apps/homepage/package.json` (latest visible in the docs at the time of writing was `16.2.6`). The standalone-instrumentation regression history ([#49897](https://github.com/vercel/next.js/issues/49897), 2023) and assorted standalone-bundle bugs are exactly the class of issue that gets quietly fixed in patch releases — pinning to an older minor risks chasing a ghost. Bump, run `npm run verify`, run a full `next build` for both apps, then proceed to the spike. Land this as a separate commit so a Next-bump regression bisects cleanly. → 16.2.6 landed in own commit; verify + both builds green.
- [x] Confirm Next.js 16's `instrumentation.ts` `register()` hook fires correctly under `output: "standalone"`. Older Next versions had a bug ([#49897](https://github.com/vercel/next.js/issues/49897)) where standalone never called `register()`. Spike test: drop a one-line `console.log("register fired")` into `apps/admin/instrumentation.ts`, build standalone, run the bundled `node server.js`, confirm the log appears before the first request is served. **If this fails on the bumped Next version, fall back to option 1.** → **Deviation:** with `instrumentation.ts` at the app root (next to `next.config.ts`), the standalone bundle did NOT include the chunk that backs `register()` — the `[turbopack]_runtime.js` reference resolved to a missing `apps_admin_*._.js` chunk and the hook never fired. Moving the file to `apps/admin/src/instrumentation.ts` (alongside `src/app/`) fixed this for both Turbopack and Webpack builds. The Next docs back this up: with a `src/` layout, instrumentation belongs **inside** `src/`. The plan's "root, not src/" wording reflected an older pages-router pattern; corrected here.
- [x] Confirm the bundled standalone's `node_modules` contains `drizzle-orm/libsql/migrator` and `@libsql/client`. They're already runtime deps for `apps/admin`, but `next build` only bundles what's reachable from `import`s — verify by `grep -r "libsql/migrator" apps/admin/.next/standalone/node_modules/` after a build. → Both reachable: `@libsql/client` ships under `.next/standalone/node_modules/@libsql/client/`, and the migrator is bundled into `.next/standalone/apps/admin/.next/server/chunks/apps_admin_src_*.js` (which `instrumentation.js` requires).
- [x] Confirm the prod admin currently runs as a single replica (`regions_max_allowed = 1` in `infra/terraform/containers.tf`). Document the assumption that the iteration is single-replica safe; flag a follow-up for multi-replica. → Confirmed; multi-replica advisory-lock work is left in "Out of scope".

## Scope — refactor migrate logic into a callable function [3/3]

- [x] Move the body of `apps/admin/scripts/migrate.ts` into a new module `apps/admin/src/lib/migrate.ts` exporting `runMigrations(): Promise<void>`. Keep the candidate-path lookup so it works both in dev (`packages/db/migrations`) and in standalone (`./packages/db/migrations` next to the running server). Logs should print the resolved migrations folder + the redacted DB URL on entry, and "Migrations applied" on success.
- [x] Rewrite `apps/admin/scripts/migrate.ts` as a thin CLI wrapper: `await runMigrations()` then exit. The wrapper preserves the `npm run migrate` developer flow against `.env.local`. → Verified by running the CLI against a fresh `file:/tmp/...` DB locally; both 0000 and 0001 migrations applied.
- [x] Add a `lib/migrate.test.ts` with an in-memory libSQL run that confirms `runMigrations` is idempotent (running twice against an already-migrated DB is a no-op). → Implemented with a per-test `tmpdir()` libSQL file (rather than `:memory:`) so the journal table survives the second call. `vi.stubEnv` keeps the env validator happy under `NODE_ENV=test` (file: URLs allowed there).

## Scope — wire into Next.js instrumentation [3/3]

- [x] Create `apps/admin/instrumentation.ts` (root of the app, **not** under `src/`). In `register()`, gate on `process.env.NEXT_RUNTIME === "nodejs"` and call `await (await import("./src/lib/migrate")).runMigrations()`. → Created at `apps/admin/src/instrumentation.ts` (see deviation in pre-flight item 2). Import path is `./lib/migrate`.
- [x] Add a `MIGRATE_ON_BOOT=false` escape hatch (env-controlled) so a future operator can boot the container without running migrations — useful if a bad migration needs manual intervention. Default is `true` in production. → Implemented; explicit "false" / "0" disables. When disabled in production, the hook logs a loud `console.warn` so the surprise toggle is visible in deploy logs.
- [x] Surface migration failures clearly: catch + `console.error` with structured fields (`migration_failed=1`, error message, migrations folder), then re-throw so the boot fails. Document in the runbook that crash-looping pods after a deploy almost certainly mean a failed migration; check container logs. → Done; the error log is a single JSON line `{"event":"migration_failed","migration_failed":1,"message":"…"}` so the bunny dashboard can grep for it.

## Scope — bundle migrations into the standalone image [2/2]

- [x] Add a Dockerfile COPY step that places `packages/db/migrations/` next to the standalone bundle, so `apps/admin/scripts/migrate.ts`'s candidate-path lookup finds it at runtime: `COPY --from=builder /repo/packages/db/migrations ./packages/db/migrations`.
- [x] Verify the image built locally (`docker build -t admin-test -f apps/admin/Dockerfile .`) contains the migrations folder at the expected path. `docker run --rm admin-test ls /app/packages/db/migrations` should list `0000_*.sql`, `0001_*.sql`, etc. → Verified: `0000_medical_runaways.sql`, `0001_user_profile.sql`, `meta/`. Container booted with `MIGRATE_ON_BOOT=false` and the hook log appeared as expected.

## Scope — boot-time env requirements [2/2]

- [x] `runMigrations()` needs `DATABASE_URL` + `DATABASE_AUTH_TOKEN`. The container already has both via the Magic Container env (verified during this session's smoke test — `envCount: 9`). No new secrets.
- [x] Confirm iter-13's env validator allows boot-time access to these. The env loader is a module-level singleton; importing it from `lib/migrate.ts` should reuse the same parsed object. → Confirmed by triggering it during the spike: feeding a `file:` URL while `NODE_ENV=production` (baked into the standalone build) tripped the validator and crashed the boot via the migration_failed path — exactly the failure shape we want.

## Scope — runbook + deploy notes [2/2]

- [x] Update `kb/runbooks/runbook-go-live.md`: replace the manual "operator runs migrate from laptop" section with "migrations run automatically on container boot; logs surface the migration outcome before the first request is served."
- [x] Add a section to the same runbook covering the failure mode: "if the admin container fails to boot after a deploy, the most common cause is a failed migration. Inspect container logs in the bunny dashboard for `migration_failed=1`. Roll back the image via `bunnynet container app … image_tag=<previous-sha>` if a fix isn't immediate."

## Verify [1/4]

- [ ] Confirm iter-14's `user_profile` migration auto-applies on iter-15b's first deploy. Drizzle's migrator is journal-based and idempotent — it diffs `packages/db/migrations/meta/_journal.json` against the `__drizzle_migrations` table in prod and applies anything missing. After deploy, `/api/auth/get-session` should return 200 (or an empty session) instead of 500. **No separate manual backfill needed**; if the user already ran `npm -w apps/admin run migrate` against prod before this iteration shipped, the migrator simply finds nothing to apply.
- [ ] Author a throwaway test migration on a feature branch (e.g. `0002_test_table_drop_me.sql` that creates and immediately drops a test table). Push, wait for deploy, confirm logs show "Migrations applied" before the first request, and that prod DB still has the (no-op) test artefact. Roll back the migration file in the next commit. _Deferred to a follow-up — the iter-14 backfill above already exercises the "deploy with pending migration" path._
- [ ] Trigger a deliberate migration failure (broken SQL on a feature branch) and confirm: deploy succeeds image build, container fails to boot, prior pod keeps serving, deploy logs surface `migration_failed=1`. Fix the migration in a follow-up commit. _Deferred per the "Done when" note below._
- [x] `npm run verify` is green (Biome + typecheck + the new migrate.test.ts).

## Out of scope (deliberate)

- **Multi-replica migration locks.** Single replica today (`regions_max_allowed = 1`). When/if we scale, switch to a libSQL advisory-lock pattern or factor the migrate step out to CI (option 1). Track separately.
- **CI-side migrate (option 1).** Kept warm as a fallback only — implement only if the spike in pre-flight rules out option 3.
- **Migration rollback automation.** Drizzle's `migrate()` is forward-only. Rollback remains a manual operator job (write a compensating migration, deploy normally).
- **Schema introspection / drift detection.** Out of scope; covered by Drizzle's own migration journal in the meta folder.
- **Homepage app migrations.** Homepage is a static site, no DB.

## Critical files

New:
- `apps/admin/src/lib/migrate.ts` (extracted callable migrator)
- `apps/admin/src/lib/migrate.test.ts` (idempotency check)
- `apps/admin/src/instrumentation.ts` (Next.js boot hook — under `src/`, not the app root; see pre-flight deviation)

Edited:
- `apps/admin/package.json` + `apps/homepage/package.json` (bump Next.js to latest 16.x; lockfile follows)
- `package-lock.json` (Next bump fallout)
- `apps/admin/scripts/migrate.ts` (becomes a thin CLI wrapper)
- `apps/admin/Dockerfile` (copy migrations into standalone runner)
- `kb/runbooks/runbook-go-live.md` (drop manual-migrate section, add automated story)

Untouched but worth referencing:
- `packages/db/migrations/` (the SQL files driven by Drizzle journal — no change)
- `infra/terraform/containers.tf` (`regions_max_allowed = 1` — gates the single-replica assumption)

## Risks / things that could bite

- **Standalone register-hook regression.** If Next 16 silently doesn't call `register()` under standalone (the old [#49897](https://github.com/vercel/next.js/issues/49897) bug), migrations will not run and we get the same iter-15 symptom in disguise. Pre-flight item 1 catches this; bake the spike into CI as a smoke test if we're paranoid.
- **Cold-start latency.** Each container boot spends ~1–3s on the migrate call even when there's nothing to apply. Acceptable for an admin app behind a CDN; revisit only if cold starts become user-visible.
- **Migration takes longer than the readiness probe.** If a future migration is large enough that boot exceeds Bunny's readiness window, the pod gets killed mid-migration. Drizzle's migrator runs each file in a transaction, so a kill should leave the DB in a consistent pre-file state — but very large migrations should be split. Document the per-file budget.
- **Schema fail re-creates the iter-15 symptom shape.** If the migration succeeds but the app code expects a column that wasn't migrated (e.g. a typo'd field name), `/api/auth/*` 500s the same way. Mitigation: typecheck against the Drizzle schema in `npm run verify`; the type errors should surface mismatches before deploy.
- **`MIGRATE_ON_BOOT=false` accidentally left set.** A surprise toggle from a debugging session. Mitigation: warn loudly at boot if the flag is set in production (`NODE_ENV=production && !MIGRATE_ON_BOOT` → log a yellow line so it's visible in deploy logs).

## Done when [1/6]

- [ ] **Admin app is live end-to-end.** A real browser session (driven via `ff-rdp`) reaches `https://admin.wardrobe-assistants.ch/login`, signs in with valid credentials, and lands on the authenticated dashboard. No 500s on any auth API along the path. _Pending PR merge + deploy._
- [ ] A fresh deploy with a pending migration applies it before serving the first request, with `Migrations applied.` visible in container logs. _Pending PR merge + deploy._
- [ ] Iter-14's `user_profile` migration is applied to prod (auto-applied on iter-15b's first deploy via the boot-time Drizzle migrator — journal-based and idempotent — unless an operator already migrated manually before this lands) and `/api/auth/get-session` returns 200 instead of 500. _Pending PR merge + deploy._
- [ ] A deploy whose migration intentionally fails leaves the prior pod serving and surfaces `migration_failed=1` in logs (manual test from one feature branch — fixed in the next). _Deferred to a follow-up._
- [x] `kb/runbooks/runbook-go-live.md` no longer instructs operators to run migrations manually.
- [ ] iter-16+ can introduce schema changes confident the deploy machinery applies them. _Earned once the deploy verification above is green._
