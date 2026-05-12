"use client";

import { authClient } from "@/lib/auth-client";
import {
  type Permission,
  ROLE_PERMISSIONS,
  type Role,
} from "@/lib/permissions";

type SessionData = ReturnType<typeof authClient.useSession>["data"];

function roleFromSession(session: SessionData): Role | undefined {
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  return role === "ADMIN" || role === "SQUAD_MEMBER" ? role : undefined;
}

// Client-side mirror of `userHasPermission`. Reads role from
// `authClient.useSession()` and checks the in-code ROLE_PERMISSIONS map —
// isomorphic with the server check.
export function useHasPermission(perm: Permission): boolean {
  const { data: session } = authClient.useSession();
  const role = roleFromSession(session);
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(perm);
}
