---
title: Tables
type: architecture
status: current
---

# Tables — responsive strategy

Tables with **>3 columns** must render as **stacked cards on mobile, table on desktop**. Tables with **≤3 columns** can stay as a horizontal-scrolling table.

```tsx
// Tables wider than 3 columns:
<div className="md:hidden space-y-3">
  {rows.map((row) => (
    <Card key={row.id} className="p-4">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Name</dt><dd>{row.name}</dd>
        <dt className="text-muted-foreground">Role</dt><dd>{row.role}</dd>
        <dt className="text-muted-foreground">Status</dt><dd>{row.status}</dd>
      </dl>
      <div className="mt-3 flex justify-end"><RowActions row={row} /></div>
    </Card>
  ))}
</div>
<Table className="hidden md:table">…desktop table…</Table>
```

The mobile card is a label-value `<dl>` — accessible, scannable, no horizontal scroll.

**TanStack Table.** Do **not** introduce `@tanstack/react-table` for read-only data. Only adopt it if the page genuinely needs sorting, multi-column filtering, or client-side pagination, and document the justification in the iteration plan. The current `BookingsTable` (`apps/admin/src/features/bookings/components/BookingsTable.tsx`) is a plain `<Table>`.

**Mobile-first answer:** stacked cards.

**Desktop answer:** `<Table>` with `aria-label="<entity> list"` and `<TableCaption>` hidden visually but present for SR.

**Don't:**
- A wide `<Table>` with `overflow-x-auto` as the only mobile concession — squinting and scrolling.
- TanStack Table for static lists.
- Mixing card and table renderers under the same breakpoint — pick one per breakpoint.

---

See also: [design-system index](README.md) · [a11y baseline](a11y.md) · [status badges](status-badges.md)
