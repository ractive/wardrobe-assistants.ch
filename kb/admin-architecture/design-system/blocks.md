---
title: Blocks adopted
type: architecture
status: current
---

# Blocks adopted

Shadcn blocks vendored today. See [ui-stack.md §Blocks](../ui-stack.md) and [`https://ui.shadcn.com/blocks`](https://ui.shadcn.com/blocks).

| Block | How used |
|---|---|
| `@shadcn/sidebar-07` | Grafted into `apps/admin/src/components/DashboardSidebar.tsx` — icon-collapse on desktop, offcanvas on mobile, footer with user menu + theme toggle, grouped nav. `<HasPermission>` gates around each link. |
| `@shadcn/login-03` | UI shell only (not the Google Chrome browser): muted-bg full-screen flex shell, `max-w-sm` column, `<BrandBadge>` above the form. Form bodies are local components. |
| `@shadcn/dashboard-01` | Layout reference only; not vendored. Hand-written `(dashboard)/page.tsx` matches its KPI grid (1×4 mobile → 2×2 `md:` → 4×1 `xl:`) + chart placeholder + recent-bookings split, without pulling in the `@dnd-kit/*`, `recharts`, `@tabler/icons-react`, `@tanstack/react-table`, `vaul` bundle. |
| `@shadcn/mode-toggle` | Vendored as `components/ThemeToggle.tsx`. Anchored in the sidebar footer. |
| `@shadcn/empty` | Vendored as `components/ui/empty.tsx`. Used by the dashboard chart placeholder and the recent-bookings empty state. |

---

See also: [design-system index](README.md) · [ui-stack](../ui-stack.md) · [layout primitives](layout-primitives.md)
