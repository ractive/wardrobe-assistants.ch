import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

// Resolves migrations folder relative to this script. In the standalone
// Docker image we copy packages/db/migrations next to it; locally it lives in
// packages/db/migrations.
const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(here, "../migrations"),
  resolve(here, "../../packages/db/migrations"),
  resolve(here, "../../../packages/db/migrations"),
];

const migrationsFolder = candidates.find((p) => existsSync(p));
if (!migrationsFolder) {
  throw new Error(
    `Could not locate migrations folder. Tried: ${candidates.join(", ")}`,
  );
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run migrations");
}
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

const client = createClient({ url, authToken });
const db = drizzle(client);

console.log(`Applying migrations from ${migrationsFolder} to ${url}…`);
await migrate(db, { migrationsFolder });
console.log("Migrations applied.");

await client.close();
