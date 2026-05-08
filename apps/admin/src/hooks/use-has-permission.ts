"use client";

import { authClient } from "@/lib/auth-client";
import {
  type Permission,
  ROLE_PERMISSIONS,
  type Role,
} from "@/lib/permissions";

// Client-side mirror of `userHasPermission`. Reads role from
// `authClient.useSession()` and checks the in-code ROLE_PERMISSIONS map —
// isomorphic with the server check.
export function useHasPermission(perm: Permission): boolean {
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role as
    | Role
    | undefined;
  if (role !== "ADMIN" && role !== "SQUAD_MEMBER") return false;
  return ROLE_PERMISSIONS[role].has(perm);
}
