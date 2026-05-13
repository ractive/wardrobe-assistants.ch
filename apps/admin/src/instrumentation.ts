// Next.js boot-time hook. `register()` runs once per server instance, before
// the first request is served — giving us a place to apply Drizzle migrations
// against the libSQL DB the runtime container is about to talk to.
//
// Why here (not Dockerfile CMD or CI):
//   - The standalone bundle has its own minimal node_modules tree under
//     apps/admin/.next/standalone/. Calling drizzle-orm/libsql/migrator from
//     a CMD wrapper script (iter-09's attempt) can't resolve those deps; an
//     instrumentation hook resolves through the bundle's own resolver.
//   - No new CI secret needed. Runtime container env already has
//     DATABASE_URL + DATABASE_AUTH_TOKEN.
//   - Failure crashes the boot, so a failed migration surfaces as the new
//     pod refusing to come up while the previous pod keeps serving.

import type { Instrumentation } from "next";

// iter-42 §B: log every unhandled server error to stdout so it appears in
// `bunny logs`. Runs server-side only; client-side boundary renders go to
// the browser console instead. The digest is Next.js's correlation ID — pair
// it with the browser's "Error ID:" display (SegmentError.tsx) for triage.
export const onRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context,
) => {
  const digest = (err as { digest?: string }).digest ?? "no-digest";
  const stack =
    err instanceof Error && err.stack ? `\n${err.stack}` : ` ${String(err)}`;
  console.error(
    `error: unhandled ${context.routeType} ${request.method} ${request.path} digest=${digest}${stack}`,
  );
};

export async function register(): Promise<void> {
  // Edge runtime can't run drizzle/libsql; only run on the Node server.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Escape hatch: an operator can disable boot-time migrations to bring up a
  // container without applying schema (e.g. for triage after a bad migration).
  // Default is ON; explicit "false" / "0" disables.
  const flag = process.env.MIGRATE_ON_BOOT;
  const disabled = flag === "false" || flag === "0";
  if (disabled) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[migrate] MIGRATE_ON_BOOT is disabled in production — schema changes will NOT be applied automatically",
      );
    } else {
      console.log("[migrate] MIGRATE_ON_BOOT is disabled, skipping");
    }
    return;
  }

  const { runMigrations } = await import("./lib/migrate");
  try {
    await runMigrations();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        event: "migration_failed",
        migration_failed: 1,
        message,
      }),
    );
    throw err;
  }
}
