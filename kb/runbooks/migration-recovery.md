---
title: Migration Recovery Runbook
type: runbook
status: active
tags: [migrations, drizzle, libsql, hoppy, runbook, incident]
created: 2026-05-09
related: [iac-runbook.md, runbook-go-live.md, iteration-15b-auto-db-migrations.md, iteration-16f-defense-in-depth.md]
---

# Migration Recovery Runbook

The admin container applies Drizzle migrations on boot via the
`register()` hook in `apps/admin/src/instrumentation.ts`. A failed
migration crashes boot — the new pod refuses to come up while the
previous one keeps serving. This runbook covers how to recover.

Closes audit finding **C-INF-01** / **I-05**: Drizzle has no automatic
down-migration; a bad migration on a single-container deploy needs a
documented escape hatch.

---

## Symptom

- New container won't start. `hoppy app logs` shows
  `event: "migration_failed"` JSON line, then the process exits.
- Previous container is still serving (Magic Containers does not
  retire the running instance until the new one is healthy).
- Subsequent deploys keep failing on the same migration.

---

## Triage

1. **Read the migration log** — the failure message tells you which
   migration tag failed and why (constraint violation, type mismatch,
   syntax error in raw SQL, etc.):

   ```bash
   hoppy app logs --tail 200 --app wardrobe-assistants-admin
   ```

   Look for the `migration_failed` event. The `message` field is the
   raw error text from libSQL.

2. **Identify the failing migration**. The Drizzle migrator runs them
   in `_journal.json` order; the first one not yet recorded in the
   `__drizzle_migrations` table is the one that's failing. Confirm via
   `hoppy db` (below).

---

## Inspect via `hoppy db`

`hoppy db` opens a libSQL shell against the live admin database. Use
it read-only to inspect state — never `INSERT`/`UPDATE` from here
unless you've already decided on the rollback plan in step "Manual
rollback" below.

```bash
hoppy db --app wardrobe-assistants-admin
# Then in the prompt:
> SELECT * FROM __drizzle_migrations ORDER BY id;   -- last applied tag
> .schema audit_log                                 -- check table state
> SELECT name, sql FROM sqlite_master WHERE type='table';
```

Compare the result against `packages/db/migrations/meta/_journal.json`.
The gap between "last applied tag" and "next tag in journal" is the
broken migration.

---

## Escape hatch: `MIGRATE_ON_BOOT=false`

If the failing migration is blocking deploys (e.g. you need to ship a
hotfix to *application* code that's unrelated to schema), bring the
container up without running migrations:

```bash
hoppy app env --app wardrobe-assistants-admin --set MIGRATE_ON_BOOT=false
hoppy app deploy --app wardrobe-assistants-admin   # or normal CI deploy
```

The container will boot. The instrumentation hook logs a loud
`console.warn` so the surprise toggle is visible in deploy logs.

**Do not leave `MIGRATE_ON_BOOT=false` set indefinitely** — every
subsequent deploy will skip schema. Clear the flag the moment the
underlying migration is fixed:

```bash
hoppy app env --app wardrobe-assistants-admin --unset MIGRATE_ON_BOOT
```

---

## Manual rollback

Drizzle does not generate down-migrations. Recovery is one of:

### Option A — fix-forward

Most common. Edit the broken migration SQL (or the schema source +
re-generate), redeploy. Safe when:

- The migration never partially applied (libSQL is transactional per
  statement; multi-statement migrations may have left intermediate
  state).
- The fix is a small SQL correction (e.g. wrong column type, missing
  default).

```bash
# 1. Edit packages/db/src/schema/<file>.ts
# 2. Regenerate the migration:
npm -w @wardrobe-assistants/db run db:generate -- --name <descriptive-name>
# 3. Hand-edit the generated SQL if needed (e.g. drop the half-applied
#    column before recreating).
# 4. Commit + deploy. MIGRATE_ON_BOOT can stay on.
```

### Option B — manual SQL surgery

When the broken migration left partial state that the next boot can't
reconcile (e.g. a partly-created table, a constraint that the fix-up
migration assumes is absent). Open a libSQL shell and undo the
half-applied changes:

```bash
hoppy db --app wardrobe-assistants-admin
> BEGIN;
> DROP TABLE IF EXISTS partial_table_from_failed_migration;
> -- DELETE the matching row from __drizzle_migrations if Drizzle
> -- recorded it before the failing statement:
> DELETE FROM __drizzle_migrations WHERE hash = '<hash>';
> COMMIT;
```

Then choose Option A (fix-forward) and redeploy. Always run the SQL
inside an explicit `BEGIN; ... COMMIT;` so a typo doesn't strand the DB
in a broken state.

### Option C — restore from backup

When the migration corrupted data (not just schema) and the fix-up is
not obvious. Bunny.net libSQL daily snapshots are documented in
`runbook-go-live.md`; restore the most recent pre-incident snapshot to
a *new* DB, point the container at it via `DATABASE_URL`, and resume
deploys.

This is the nuclear option — coordinate with the team before running
it. Restoring discards any application writes since the snapshot.

---

## Verifying recovery

After a fix-up deploy succeeds:

```bash
hoppy app logs --tail 50 --app wardrobe-assistants-admin
# Expect: [migrate] Migrations applied.
hoppy db --app wardrobe-assistants-admin
> SELECT tag FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;
# Expect the latest tag from packages/db/migrations/meta/_journal.json.
```

Make sure `MIGRATE_ON_BOOT` is **not** set; the env var should be
absent (default-on), not `false`.

---

## When to call for help

- The migration log shows a libSQL-internal error (`SQLITE_CORRUPT`,
  unexpected `database is locked` in single-writer mode) — this is
  not application-level, escalate to bunny support.
- Option C is on the table. Confirm the snapshot strategy and
  rollback target with another engineer before restoring.
- The same migration keeps failing after a "fix" — stop deploying
  variants and pair with someone. Each failed boot is a small extra
  blast radius (Magic Containers retains the previous pod, but
  repeated bad rollouts will eventually retire it on health-check
  policy).
