// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PROD_SECRET = "0".repeat(64);

let tmpDir: string;
let dbFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "migrate-test-"));
  dbFile = join(tmpDir, "migrate-test.db");
  // env.ts is a Proxy that lazily parses process.env on first access. The
  // test file env (NODE_ENV=test) skips the dev/prod tripwires so a file:
  // URL is acceptable.
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", `file:${dbFile}`);
  vi.stubEnv("BETTER_AUTH_SECRET", PROD_SECRET);
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("EMAIL_FROM", "test@example.test");
  vi.stubEnv("DATABASE_AUTH_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("runMigrations", () => {
  it("is idempotent — running twice against the same DB is a no-op the second time", async () => {
    const { runMigrations } = await import("./migrate");

    await expect(runMigrations()).resolves.toBeUndefined();
    // Second call must not throw — Drizzle's journal-based migrator should
    // skip already-applied migrations cleanly.
    await expect(runMigrations()).resolves.toBeUndefined();
  });
});
