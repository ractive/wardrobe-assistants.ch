import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/permissions";

const COPY: Record<Role, string> = {
  ADMIN: "Admin",
  SQUAD_MEMBER: "Squad member",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "ADMIN" ? "default" : "secondary"}>
      {COPY[role]}
    </Badge>
  );
}
