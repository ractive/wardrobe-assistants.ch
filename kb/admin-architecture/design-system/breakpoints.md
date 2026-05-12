---
title: Breakpoints
type: architecture
status: current
---

# Breakpoints + responsive baseline

Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px. **Admin must work at 375px width (iPhone SE class) and up.**

**Mobile-first answer:** write base classes for the 375–640px range, then add wider-screen variants. The cascade direction is the rule, not specific class pairs: write the mobile baseline first, then narrow/widen at `md:` / `lg:`. e.g. `flex-col md:flex-row` (mobile stacks, desktop inlines), `w-full md:w-auto` (full-width button on mobile, intrinsic on desktop), `grid-cols-1 md:grid-cols-2`. Touch targets are ≥ 44×44 px (Tailwind `min-h-11 min-w-11`).

**Desktop answer:** progressively widen with `md:` and `lg:` variants. The single column on mobile becomes a two-column grid at `md:`; the bottom-stack action row becomes inline at `md:`.

**Don't:**
- `md:flex-col` paired with a base `flex-row` (desktop-first) — inverts the intended cascade. Always start at mobile and add `md:`/`lg:` to widen, never the other way around.
- Anything that's only legible above `md`. If you can't see it on iPhone SE, it's broken.
- Touch targets below 44×44 — fingers aren't pixels.

---

See also: [design-system index](README.md) · [layout primitives](layout-primitives.md) · [a11y baseline](a11y.md) (touch-target rule)
