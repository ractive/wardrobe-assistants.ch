import { Badge } from "@/components/ui/badge";

// Per-kind status enums. Mirrored from each feature's schema.ts; kept inline
// here because shared/components is not allowed to import from features/
// (Biome `noRestrictedImports`). When a feature changes its enum, update the
// matching entry below.
type StatusByKind = {
  booking: "created" | "offered" | "accepted" | "rejected" | "cancelled";
  user: "invited" | "verified";
  serviceType: "fixed" | "hourly";
  serviceStatus: "active" | "archived";
  assignment: "assigned" | "requested" | "confirmed" | "rejected" | "withdrawn";
};

type BadgeVariant = "default" | "outline" | "secondary";

type Entry = { label: string; variant: BadgeVariant };

const VARIANTS: { [K in keyof StatusByKind]: Record<StatusByKind[K], Entry> } =
  {
    booking: {
      created: { label: "Created", variant: "outline" },
      offered: { label: "Offered", variant: "default" },
      accepted: { label: "Accepted", variant: "default" },
      rejected: { label: "Rejected", variant: "secondary" },
      cancelled: { label: "Cancelled", variant: "secondary" },
    },
    user: {
      invited: { label: "Invited", variant: "outline" },
      verified: { label: "Verified", variant: "default" },
    },
    serviceType: {
      fixed: { label: "Fixed", variant: "outline" },
      hourly: { label: "Hourly", variant: "secondary" },
    },
    serviceStatus: {
      active: { label: "Active", variant: "default" },
      archived: { label: "Archived", variant: "secondary" },
    },
    assignment: {
      assigned: { label: "Assigned", variant: "default" },
      requested: { label: "Requested", variant: "outline" },
      confirmed: { label: "Confirmed", variant: "default" },
      rejected: { label: "Rejected", variant: "secondary" },
      withdrawn: { label: "Withdrawn", variant: "secondary" },
    },
  };

export type StatusBadgeProps<
  K extends keyof StatusByKind = keyof StatusByKind,
> = {
  kind: K;
  status: StatusByKind[K];
};

export function StatusBadge<K extends keyof StatusByKind>({
  kind,
  status,
}: StatusBadgeProps<K>) {
  const entry = VARIANTS[kind][status];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
