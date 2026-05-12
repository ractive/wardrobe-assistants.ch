---
title: Layout primitives
type: architecture
status: current
---

# Layout primitives (signatures)

What's actually in `apps/admin/src/components/` today. Add new layout primitives here as they're lifted from inline code.

```tsx
// PageHeader — every dashboard page top
// apps/admin/src/components/PageHeader.tsx
type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode; // mobile: stacks below; md: inline-right
};
```

**Empty state:** the canonical **`@shadcn/empty`** primitive is vendored at `apps/admin/src/components/ui/empty.tsx`. Registry source: [`https://ui.shadcn.com/r/empty`](https://ui.shadcn.com/r/empty). Used by the dashboard chart placeholder and the recent-bookings empty state.

**Mobile-first answer:** `<PageHeader>` stacks `actions` below the title at base width, inlines them at `md:`. `<Empty>` centres its content; CTA is full-width on mobile.

**Desktop answer:** `actions` floats right of the title; `<Empty>` keeps centred content but caps width.

**Don't:**
- Building these primitives until a slice needs them — premature.
- Hand-rolling an empty-state component — use `<Empty>` from `@/components/ui/empty`.
- Inventing alternative slot names — stick to `title / description / actions / icon / action`.

---

See also: [design-system index](README.md) · [breakpoints](breakpoints.md) · [blocks adopted](blocks.md)
