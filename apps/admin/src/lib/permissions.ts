import { getCurrentUserRole } from "./auth";

export const ROLES = ["ADMIN", "SQUAD_MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Users
  "USER_INVITE",
  "USER_DELETE",
  "USER_MESSAGE",
  // Bookings
  "BOOKING_VIEW",
  "BOOKING_CREATE",
  "BOOKING_DELETE",
  "BOOKING_ASSIGN",
  "BOOKING_INVOICE",
  "BOOKING_MESSAGE_ASSIGNED",
  // Services
  "SERVICE_CREATE",
  "SERVICE_DELETE",
  // Squad-member surface
  "SQUAD_VIEW_ASSIGNED",
  "SQUAD_REQUEST_PARTICIPATION",
  // Admin reviews squad-member participation requests
  "BOOKING_APPROVE_REQUEST",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS = {
  ADMIN: new Set<Permission>(PERMISSIONS),
  SQUAD_MEMBER: new Set<Permission>([
    "BOOKING_VIEW",
    "SQUAD_VIEW_ASSIGNED",
    "SQUAD_REQUEST_PARTICIPATION",
  ]),
} satisfies Record<Role, ReadonlySet<Permission>>;

// Module-load self-check: every declared permission must be granted to at
// least one role. Catches "added a perm to PERMISSIONS but forgot to wire it
// into any role." ADMIN gets all by construction, so this only fires if both
// the ADMIN catch-all is changed AND the new perm was not added to any role.
for (const p of PERMISSIONS) {
  const granted = Object.values(ROLE_PERMISSIONS).some((s) => s.has(p));
  if (!granted) {
    throw new Error(
      `Permission "${p}" is declared in PERMISSIONS but not granted to any role.`,
    );
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class PermissionError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
  }
}

export function roleHasPermission(
  role: Role | null,
  perm: Permission,
): boolean {
  return role !== null && ROLE_PERMISSIONS[role].has(perm);
}

export async function userHasPermission(perm: Permission): Promise<boolean> {
  const role = await getCurrentUserRole();
  return roleHasPermission(role, perm);
}

export async function assertPermission(perm: Permission): Promise<void> {
  const role = await getCurrentUserRole();
  if (role === null) throw new UnauthenticatedError();
  if (!ROLE_PERMISSIONS[role].has(perm)) throw new PermissionError(perm);
}

// Wrapper for server actions: removes auth + permission boilerplate and
// injects the verified userId. Throws UnauthenticatedError / PermissionError
// — let those bubble to the action's error boundary.
export function withPermission<TArgs extends unknown[], TResult>(
  perm: Permission,
  action: (userId: string, ...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    // Lazy import keeps the dependency graph one-way: lib/permissions imports
    // from lib/auth via getCurrentUserRole, but withPermission also needs the
    // userId. Importing through a function call keeps the module-load order
    // tolerant of the auth.ts ↔ permissions.ts circular type reference.
    const { auth, roleForUserId } = await import("./auth");
    const { headers } = await import("next/headers");
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new UnauthenticatedError();
    const role = await roleForUserId(session.user.id);
    if (!role) throw new PermissionError(perm);
    if (!ROLE_PERMISSIONS[role].has(perm)) {
      throw new PermissionError(perm);
    }
    return action(session.user.id, ...args);
  };
}
