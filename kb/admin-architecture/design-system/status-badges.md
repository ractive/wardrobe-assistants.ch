---
title: Status badges
type: architecture
status: current
---

# Status badges

One shared component (`apps/admin/src/components/StatusBadge.tsx`), per-`kind` variant maps mirrored from each feature's `schema.ts` (cross-feature imports are forbidden, so the maps are inlined here).

```tsx
// Sketch — the live file maps booking / user / serviceType / serviceStatus / assignment.
type StatusByKind = {
  booking: "created" | "offered" | "accepted" | "rejected" | "cancelled";
  user: "invited" | "verified";
  serviceStatus: "active" | "archived";
  // …
};
type BadgeVariant = "default" | "outline" | "secondary";

const VARIANTS: { [K in keyof StatusByKind]: Record<StatusByKind[K], { label: string; variant: BadgeVariant }> } = {
  booking: {
    created: { label: "Created", variant: "outline" },
    offered: { label: "Offered", variant: "default" },
    accepted: { label: "Accepted", variant: "default" },
    rejected: { label: "Rejected", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "secondary" },
  },
  // …
};
```

**Bordeaux palette note (iter-32).** Under the bordeaux primary, a `default` badge (e.g. accepted booking) and a `destructive` badge (e.g. cancelled) sit visually close because both are red-family. The current `StatusBadge.tsx` deliberately maps `cancelled` and `rejected` to `secondary` (not `destructive`) so the two coloured states (`default` bordeaux, `outline` neutral, `secondary` muted) read as distinct at list-scan distance. Don't introduce a `destructive` badge variant on the booking statuses without re-auditing this trade-off.

**Mobile-first answer:** identical to desktop.

**Desktop answer:** identical.

**Don't:**
- Per-feature `RoleBadge` / `StatusBadge` / `EventStatusBadge` files all doing the same thing — consolidate.
- Encoding state purely with colour — keep the text label inside the badge for SR users and colour-blind admins.

---

See also: [design-system index](README.md) · [tokens](tokens.md) · [tables](tables.md)
