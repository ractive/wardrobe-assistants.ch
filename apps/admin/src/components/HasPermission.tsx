import type { ReactNode } from "react";
import { type Permission, userHasPermission } from "@/lib/permissions";

// Async server component. Renders `children` when the current session has
// `perm`, otherwise `fallback`. Use for declarative perm gating in RSC trees;
// no JS ships to the client when the child branch doesn't render.
export async function HasPermission({
  perm,
  fallback = null,
  children,
}: {
  perm: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const allowed = await userHasPermission(perm);
  return allowed ? children : fallback;
}
