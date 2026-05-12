---
title: Table component evaluation — shared abstraction vs per-feature tables
type: research-note
status: complete
iteration: iter-40
---

## What is shared across the three tables?

All three tables (`BookingsTable`, `ServicesTable`, `UsersTable`) follow the same structural pattern:

- **Empty state**: a centred card with `rounded-md border bg-[var(--card)] p-8 text-center` copy.
- **Mobile cards**: `<ul class="flex flex-col gap-3 md:hidden">` with each item as a `<li class="rounded-md border bg-[var(--card)] p-4">`. Card body uses a `<dl class="grid grid-cols-[max-content_1fr]">` for key-value pairs.
- **Desktop table**: `<div class="hidden rounded-md border md:block"><Table aria-label="...">` with `<TableHeader>` + `<TableBody>`.
- **shadcn `<Table>` shell**: all three import from `@/components/ui/table`.

That structural skeleton is identical in all three. The wrapper `div`, border, empty state container, and mobile-list pattern are copy-pasted.

## What diverges?

| Dimension | BookingsTable | ServicesTable | UsersTable |
|---|---|---|---|
| Row click | whole-row link (`<Link>` fills cell) | client component (`ServiceTableRow`) opens edit dialog | no row click |
| Columns | Name, Date, Venue, Status, Assignees | Name, Type, Price, Status, Actions | Name, Email, Role, Status, Created, Actions |
| Actions | none in table (action is navigation) | `ServiceActionsMenu` (2 icon buttons) | `UserActionsMenu` (2 icon buttons) |
| Mobile card extra | `StatusBadge`, optional `RequestsBadge` | `StatusBadge` for type + status | `RoleBadge` + `StatusBadge` |
| Data source type | `BookingListItem[]` | `ServiceListItem[]` | `UserListItem[]` |
| Sort / filter | none | none | none |

## Recommendation: don't build a shared component now

The shared structure is real, but it lives entirely in HTML/Tailwind class strings, not in component logic. A shared `<DataTable>` abstraction would need to accept:
- Column definitions (headers + cell renderers)
- Mobile card render prop
- Empty state copy
- Optional row click handler
- Whether actions column exists

That's essentially re-implementing TanStack Table's `ColumnDef` API with a custom wrapper, adding ~200 lines of generic boilerplate that each table then partially opts out of (BookingsTable's row-click links are fundamentally different from the click pattern in ServicesTable, which owns a client dialog).

The code duplication cost today is low: each table is 80–180 lines, the duplicated structural shell is ~20 lines, and the tables diverge enough that an abstraction would add more prop-drilling noise than it removes. If a fourth table lands with similar shape, or if sort/filter is added uniformly, revisit then.

**Queued for iter-40b if needed**: if a shared `<AdminTable>` abstraction is later motivated by a concrete use-case (pagination, global sort, filter bar), define the API from that requirement rather than bottom-up from the current three.
