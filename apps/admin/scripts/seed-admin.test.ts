import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@wardrobe-assistants/db";
import { schema } from "@wardrobe-assistants/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";
import { isSeedNeeded } from "./seed-admin.lib";

const here = fileURLToPath(new URL(".", import.meta.url));
const migrationsFolder = join(
  here,
  "..",
  "..",
  "..",
  "packages",
  "db",
  "migrations",
);

describe("seed-admin idempotency", () => {
  it("reports seed needed when user does not exist", async () => {
    const db = createDb({ url: ":memory:" });
    await migrate(db, { migrationsFolder });
    expect(await isSeedNeeded(db, "admin@example.com")).toBe(true);
  });

  it("reports seed not needed once the user is present", async () => {
    const db = createDb({ url: ":memory:" });
    await migrate(db, { migrationsFolder });
    const now = new Date();
    await db.insert(schema.user).values({
      id: "seed-1",
      email: "admin@example.com",
      name: "admin",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(await isSeedNeeded(db, "admin@example.com")).toBe(false);
  });
});
