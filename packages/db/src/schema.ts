import * as auditLogSchema from "./schema/audit_log";
import * as authSchema from "./schema/auth";
import * as bookingAssignmentsSchema from "./schema/booking-assignments";
import * as bookingsSchema from "./schema/bookings";
import * as pushSubscriptionsSchema from "./schema/push-subscriptions";
import * as servicesSchema from "./schema/services";
import * as usersSchema from "./schema/users";

export * from "./schema/audit_log";
export * from "./schema/auth";
export * from "./schema/booking-assignments";
export * from "./schema/bookings";
export * from "./schema/push-subscriptions";
export * from "./schema/services";
export * from "./schema/users";

// Aggregate object for Drizzle adapters / consumers that pass a single schema.
export const schema = {
  ...authSchema,
  ...usersSchema,
  ...bookingsSchema,
  ...bookingAssignmentsSchema,
  ...servicesSchema,
  ...auditLogSchema,
  ...pushSubscriptionsSchema,
};
