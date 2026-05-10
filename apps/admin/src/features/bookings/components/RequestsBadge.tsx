import { Badge } from "@/components/ui/badge";

interface RequestsBadgeProps {
  count: number;
}

export function RequestsBadge({ count }: RequestsBadgeProps) {
  if (count === 0) return null;
  return (
    <Badge
      variant="secondary"
      aria-label={`${count} pending request${count === 1 ? "" : "s"}`}
    >
      {count}
    </Badge>
  );
}
