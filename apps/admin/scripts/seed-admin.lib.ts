import type { Database } from "@wardrobe-assistants/db";
import { schema } from "@wardrobe-assistants/db/schema";
import { eq } from "drizzle-orm";

// Extracted from seed-admin.ts so it can be tested in isolation against an
// in-memory libSQL database without spinning up the Better Auth runtime.

export async function isSeedNeeded(
  db: Database,
  email: string,
): Promise<boolean> {
  const existing = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  return existing.length === 0;
}
