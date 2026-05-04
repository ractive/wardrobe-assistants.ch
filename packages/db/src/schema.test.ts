import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";
import { account, session, twoFactor, user, verification } from "./schema";

const here = fileURLToPath(new URL(".", import.meta.url));
const migrationsFolder = join(here, "..", "migrations");

describe("packages/db schema", () => {
  it("exports the Better Auth core tables", () => {
    expect(user).toBeDefined();
    expect(session).toBeDefined();
    expect(account).toBeDefined();
    expect(verification).toBeDefined();
    expect(twoFactor).toBeDefined();
  });

  it("createDb returns a working in-memory client", async () => {
    const db = createDb({ url: "file::memory:?cache=shared" });
    const rows = await db.run(sql`select 1 as one`);
    expect(rows.rows).toHaveLength(1);
  });

  it("migrations folder exists with at least one .sql file", () => {
    expect(existsSync(migrationsFolder)).toBe(true);
    const files = readdirSync(migrationsFolder).filter((f) =>
      f.endsWith(".sql"),
    );
    expect(files.length).toBeGreaterThan(0);
  });

  it("applies migrations against in-memory libSQL", async () => {
    const db = createDb({ url: ":memory:" });
    await migrate(db, { migrationsFolder });
    // After migrate, user table should exist and accept inserts.
    const now = new Date();
    await db.insert(user).values({
      id: "u_1",
      name: "Test",
      email: "t@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    const rows = await db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("t@example.com");
  });
});
