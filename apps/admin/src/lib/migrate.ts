import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { env } from "./env";

// libSQL URLs occasionally embed credentials (e.g. file:memdb?authToken=…).
// Strip query string + userinfo before logging.
function redactUrl(url: string): string {
  return url.replace(/\?.*$/u, "").replace(/:\/\/[^@/]+@/u, "://");
}

function resolveMigrationsFolder(): string {
  // The function is called from two distinct call sites:
  //   - scripts/migrate.ts (CLI), where __dirname resolves under apps/admin/src/lib
  //   - instrumentation.ts (Next standalone bundle), where this file is bundled
  //     into apps/admin/.next/standalone/apps/admin/.next/server/chunks/... and
  //     the Dockerfile copies packages/db/migrations to /app/packages/db/migrations.
  // We probe a handful of likely roots; the first existing folder wins.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Standalone runtime: /app/packages/db/migrations relative to cwd.
    resolve(process.cwd(), "packages/db/migrations"),
    // Local dev: apps/admin/src/lib → packages/db/migrations.
    resolve(here, "../../../../packages/db/migrations"),
    // Sibling-bundle layout (defence in depth).
    resolve(here, "../../../packages/db/migrations"),
    resolve(here, "../../packages/db/migrations"),
    resolve(here, "../migrations"),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `Could not locate migrations folder. Tried: ${candidates.join(", ")}`,
    );
  }
  return found;
}

export async function runMigrations(): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();
  const url = env.databaseUrl;
  const authToken = env.databaseAuthToken;
  const safeUrl = redactUrl(url);

  console.log(
    `[migrate] applying migrations from ${migrationsFolder} to ${safeUrl}`,
  );
  const client = createClient({ url, authToken });
  const db = drizzle(client);
  try {
    await migrate(db, { migrationsFolder });
    console.log("[migrate] Migrations applied.");
  } finally {
    await client.close();
  }
}
