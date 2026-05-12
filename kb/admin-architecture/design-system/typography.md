---
title: Typography
type: architecture
status: current
---

# Typography

Tiny set, used consistently.

| Role | Class |
|---|---|
| h1 (page title) | `text-2xl md:text-3xl font-semibold` |
| h2 (section title) | `text-lg md:text-xl font-medium` |
| body | `text-sm` |
| help / caption | `text-xs text-muted-foreground` |
| table cell, dense list | `text-sm` |

Font is `Inter, ui-sans-serif, system-ui, sans-serif` — already wired in `globals.css`.

**Mobile-first answer:** the smaller side of each pair (`text-2xl`, `text-lg`).

**Desktop answer:** the larger side via `md:`.

**Don't:**
- `text-base` for body — we use `text-sm`.
- Bolding for emphasis where colour or hierarchy already does the job.
- `font-bold` on headings — `font-semibold` / `font-medium` is enough.

---

See also: [design-system index](README.md) · [spacing](spacing.md) · [a11y baseline](a11y.md)
