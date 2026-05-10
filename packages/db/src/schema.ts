import * as auditLogSchema from "./schema/audit_log";
import * as authSchema from "./schema/auth";
import * as eventsSchema from "./schema/events";
import * as pushSubscriptionsSchema from "./schema/push-subscriptions";
import * as servicesSchema from "./schema/services";
import * as usersSchema from "./schema/users";

export * from "./schema/audit_log";
export * from "./schema/auth";
export * from "./schema/events";
export * from "./schema/push-subscriptions";
export * from "./schema/services";
export * from "./schema/users";

// Aggregate object for Drizzle adapters / consumers that pass a single schema.
export const schema = {
  ...authSchema,
  ...usersSchema,
  ...eventsSchema,
  ...servicesSchema,
  ...auditLogSchema,
  ...pushSubscriptionsSchema,
};
