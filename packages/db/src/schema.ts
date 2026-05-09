import * as auditLogSchema from "./schema/audit_log";
import * as authSchema from "./schema/auth";
import * as eventsSchema from "./schema/events";
import * as usersSchema from "./schema/users";

export * from "./schema/audit_log";
export * from "./schema/auth";
export * from "./schema/events";
export * from "./schema/users";

// Aggregate object for Drizzle adapters / consumers that pass a single schema.
export const schema = {
  ...authSchema,
  ...usersSchema,
  ...eventsSchema,
  ...auditLogSchema,
};
