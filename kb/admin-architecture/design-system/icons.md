---
title: Icons
type: architecture
status: current
---

# Icons

`lucide-react` everywhere. shadcn already wires it via `components.json`.

| Position | Class |
|---|---|
| Inline (next to text) | `size-4` |
| Button-leading (icon before button label) | `size-4` (default; `size-5` only when the button is `lg`) |
| Standalone tap target | wrap in a `size-11` interactive element so the touch target is ≥ 44×44 |

All icons in interactive context (buttons, links, dropdowns) get `aria-hidden="true"` plus a sibling text label or an `aria-label` on the wrapper. **No Unicode dingbats** (✓ ✗ ➜ ⚠️) — they are announced inconsistently by screen readers (e.g. "check mark" or "heavy multiplication x") and bypass our typographic scale (F-FE-23).

```tsx
<Button>
  <PlusIcon aria-hidden="true" className="size-4" />
  Invite user
</Button>

// Icon-only button — must label the wrapper:
<Button size="icon" aria-label="Open menu">
  <MenuIcon aria-hidden="true" className="size-5" />
</Button>
```

**Mobile-first answer:** icon-only triggers must be ≥ 44×44 (use shadcn's `size="icon"` plus `min-h-11 min-w-11` if needed).

**Desktop answer:** identical.

**Don't:**
- Unicode dingbats anywhere in admin source.
- Icons without `aria-hidden` next to no text label.
- Mixing icon libraries — Lucide only.

---

See also: [design-system index](README.md) · [a11y baseline](a11y.md) · [anti-patterns](anti-patterns.md)
