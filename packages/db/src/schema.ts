import * as authSchema from "./schema/auth";
import * as usersSchema from "./schema/users";

export * from "./schema/auth";
export * from "./schema/users";

// Aggregate object for Drizzle adapters / consumers that pass a single schema.
export const schema = {
  ...authSchema,
  ...usersSchema,
};
