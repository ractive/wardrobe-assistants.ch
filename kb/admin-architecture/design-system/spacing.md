---
title: Spacing
type: architecture
status: current
---

# Spacing

One scale, everywhere. Pick from the table; do not invent new values.

| Use | Class |
|---|---|
| Page padding (mobile→desktop) | `px-4 py-6 md:px-6 md:py-8` |
| Section gap (between page-level blocks) | `gap-6` (or `space-y-6`) |
| Card padding | `p-4` |
| Inline gap (label + input, icon + text, button row) | `gap-2` |
| Form field stack | `space-y-4` |

**Mobile-first answer:** use the mobile-first column of `px-4 py-6` etc. above, widening at `md:`.

**Desktop answer:** the `md:` half of the same classes.

**Don't:**
- One-off magic numbers (`pt-7`, `gap-3.5`) — pick from the scale.
- Mixing `space-y-*` and `gap-*` in the same container — pick one.

---

See also: [design-system index](README.md) · [typography](typography.md) · [layout primitives](layout-primitives.md)
