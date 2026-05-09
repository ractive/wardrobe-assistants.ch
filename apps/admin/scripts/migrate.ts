import { runMigrations } from "../src/lib/migrate";

// Thin CLI wrapper around runMigrations(). The shared logic — env loading,
// libSQL client construction, migrations-folder resolution, Drizzle's
// migrate() call — lives in src/lib/migrate.ts so the same code path can be
// invoked from Next's instrumentation hook on container boot.
await runMigrations();
