import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { schema } from "./schema";

export type CreateDbOptions = {
  url: string;
  authToken?: string;
};

export type Database = ReturnType<typeof createDb>;

export function createDb({ url, authToken }: CreateDbOptions) {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}
