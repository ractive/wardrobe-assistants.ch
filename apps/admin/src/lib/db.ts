import { createDb } from "@wardrobe-assistants/db";
import { env } from "./env";

// Module-level singleton: Next.js App Router can re-execute server modules
// across requests, but the libSQL client is cheap to keep around and avoids
// a fresh TLS handshake per request.
export const db = createDb({
  url: env.databaseUrl,
  authToken: env.databaseAuthToken,
});
