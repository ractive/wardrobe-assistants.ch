import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Dev-only bootstrap. Wipes apps/admin/dev.db, runs migrations, and seeds the
// first admin user with throwaway credentials. Refuses to run in production.
//
// Usage:
//   npm -w @wardrobe-assistants/admin run db:reset
// Or, from the repo root:
//   npm run db:reset:admin

if (process.env.NODE_ENV === "production") {
  console.error(
    "db:reset is a dev-only script and refuses to run when NODE_ENV=production.",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const adminRoot = resolve(here, "..");
const envLocalPath = resolve(adminRoot, ".env.local");
const envExamplePath = resolve(adminRoot, ".env.example");
const dbPath = resolve(adminRoot, "dev.db");

// Step 1 — make sure .env.local exists. On a fresh clone we synthesise one
// from .env.example, generating a real BETTER_AUTH_SECRET so the env loader
// is happy and so cookies stay valid across restarts of the same checkout.
if (!existsSync(envLocalPath)) {
  if (!existsSync(envExamplePath)) {
    console.error(
      `Cannot bootstrap: ${envExamplePath} is missing. Did the repo layout change?`,
    );
    process.exit(1);
  }
  const generatedSecret = randomBytes(32).toString("hex");
  const example = readFileSync(envExamplePath, "utf8");
  const populated = example
    .replace(
      /^BETTER_AUTH_SECRET=.*$/m,
      `BETTER_AUTH_SECRET=${generatedSecret}`,
    )
    .replace(/^RESEND_API_KEY=.*$/m, "RESEND_API_KEY=")
    .replace(/^ADMIN_EMAIL=.*$/m, "ADMIN_EMAIL=admin@localhost")
    .replace(/^ADMIN_PASSWORD=.*$/m, "ADMIN_PASSWORD=dev-only-not-secure");
  writeFileSync(envLocalPath, populated, { mode: 0o600 });
  console.log(`Wrote ${envLocalPath} (BETTER_AUTH_SECRET generated).`);
}

// Step 2 — load .env.local into process.env so the spawned migrate/seed
// processes inherit a fully populated environment. We don't pull in dotenv as
// a dep; this parser handles the simple KEY=VALUE shape we ship.
function loadEnvFile(path: string): void {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
loadEnvFile(envLocalPath);

// Defaults if .env.local existed but didn't set these (e.g. the user deleted
// them after the initial bootstrap). seed-admin will refuse to run otherwise.
if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = "admin@localhost";
if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = "dev-only-not-secure";
}

// Step 3 — wipe the dev DB. SQLite drops a few sidecar files when journaling
// is on; clear them too so the next migration starts from a clean slate.
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const target = `${dbPath}${suffix}`;
  if (existsSync(target)) {
    rmSync(target);
    console.log(`Removed ${target}.`);
  }
}

// Step 4 — run migrations and seed via npm so package-relative resolution and
// tsx's --env-file handling stay consistent with how a developer would run
// these scripts directly.
function runNpm(script: string): void {
  const result = spawnSync(
    "npm",
    ["-w", "@wardrobe-assistants/admin", "run", script],
    { stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) {
    console.error(`\nnpm run ${script} failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

runNpm("migrate");
runNpm("seed:admin");

console.log(
  "\nDev database is ready. Start the admin app with:\n  npm run dev:admin",
);
