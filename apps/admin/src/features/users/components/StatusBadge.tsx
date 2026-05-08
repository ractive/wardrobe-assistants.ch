import { Badge } from "@/components/ui/badge";

type Status = "invited" | "verified";

const COPY: Record<Status, string> = {
  invited: "Invited",
  verified: "Verified",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={status === "verified" ? "default" : "outline"}>
      {COPY[status]}
    </Badge>
  );
}
