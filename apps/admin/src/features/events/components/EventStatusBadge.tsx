import { Badge } from "@/components/ui/badge";
import type { EventStatus } from "../schema";

const COPY: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
  done: "Done",
};

const VARIANT: Record<EventStatus, "default" | "outline" | "secondary"> = {
  draft: "outline",
  published: "default",
  cancelled: "secondary",
  done: "secondary",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={VARIANT[status]}>{COPY[status]}</Badge>;
}
