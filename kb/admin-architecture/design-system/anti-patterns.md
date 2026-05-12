---
title: Anti-patterns
type: architecture
status: current
---

# Anti-patterns

A condensed list of things the rest of the doc forbids — useful in code review.

| Don't | Why |
|---|---|
| `<div onClick>` on non-interactive elements | Not focusable, not labellable; use `<button>` |
| Hex literals in `apps/admin/src/` (excl. `components/ui/`) | Tokens are the single source of truth |
| `useMemo` / `useCallback` for cheap derivations | React Compiler handles them; manual memo adds noise |
| Unicode dingbats (✓ ✗ ➜ ⚠️) | Kill screen-reader output; not on the typographic scale |
| Raw `<input>` / `<select>` / `<textarea>` in forms | Bypasses `<Form>`; field-level a11y/validation breaks |
| `@tanstack/react-table` for static read-only lists | Adds bundle weight for no behaviour |
| Manual focus rings (`focus:outline outline-2`) | shadcn `focus-visible:` ring already exists; don't duplicate |
| Reusing write permission to gate a read | F-FE-08 — silently hides legitimate reads |
| Form on `Dialog` on mobile | Soft keyboard + small dialog = unusable; use `Sheet side="bottom"` |
| Animating without `motion-safe:` | Ignores `prefers-reduced-motion` |
| Per-feature duplicate badges (`RoleBadge` etc.) | Use the shared `<StatusBadge kind status>` |

---

See also: [design-system index](README.md) · [overview](../overview.md)
