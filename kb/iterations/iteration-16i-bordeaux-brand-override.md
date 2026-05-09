---
title: Iteration 16i — Re-apply Bordeaux brand override on shadcn-neutral
type: iteration
order: 18.0
status: planned
---

# Iteration 16i — Re-apply Bordeaux brand override on shadcn-neutral

iter-16h adopted `@shadcn/theme-neutral` wholesale and dropped the Bordeaux primary in the admin so the canonical baseline could land cleanly. This iteration layers the brand colour back on top — selectively, only on `--primary` and its derivatives — without touching the rest of the canonical palette.

The trade-off: ~10 lines of CSS in exchange for a Bordeaux focus ring, primary buttons, sidebar-active state, and brand badge. Everything else (background, card, muted, accent, destructive, chart palette, sidebar-accent, border, input, ring) stays canonical-neutral and continues to track upstream.

## Pre-flight

- [ ] iter-16h merged. `globals.css` is the verbatim `@shadcn/theme-neutral` output.
- [ ] User has lived with the neutral admin long enough to confirm the brand-loss hurts. If neutral feels fine, this iteration can be deferred or dropped.

## Scope

- [ ] Append a brand-override block to the end of `apps/admin/src/app/globals.css` — five tokens per mode, oklch:

  ```css
  /* Bordeaux brand override on top of @shadcn/theme-neutral */
  :root {
    --primary: oklch(0.59 0.12 28);            /* #b5564f equivalent */
    --primary-foreground: oklch(0.985 0 0);
    --ring: oklch(0.59 0.12 28);
    --sidebar-primary: oklch(0.59 0.12 28);
    --sidebar-primary-foreground: oklch(0.985 0 0);
  }
  .dark {
    --primary: oklch(0.59 0.12 28);
    --primary-foreground: oklch(0.985 0 0);
    --ring: oklch(0.59 0.12 28);
    --sidebar-primary: oklch(0.59 0.12 28);
    --sidebar-primary-foreground: oklch(0.985 0 0);
  }
  ```

- [ ] Verify the oklch value against the historical hex `#b5564f` using shadcn's theme generator or any oklch converter; adjust the lightness/chroma if perception drifts.
- [ ] Smoke at 375 + 1024 in light + dark: primary buttons, focus rings, sidebar active state, login brand badge are visibly Bordeaux. Everything else looks identical to iter-16h's canonical output.
- [ ] WCAG AA: `--primary-foreground` on `--primary` ≥ 4.5:1 in both modes. If `oklch(0.985 0 0)` doesn't pass, swap for a slightly darker variant.
- [ ] Update `decision-log.md`: append a follow-up note to iter-16h's "adopt over invent" ADR — "Bordeaux re-applied on `--primary` only; rest of palette remains upstream-tracked."

## Out of scope

- **Brand-customizing anything beyond `--primary` and its sidebar/ring derivatives.** If `--accent` or `--secondary` need brand-tinting later, that's a separate iteration with its own ADR.
- **Customer-facing homepage palette.** Independent track.

## Critical files

Edited:
- `apps/admin/src/app/globals.css` — five-line override block per mode
- `kb/admin-architecture/decision-log.md` — follow-up note

## Done when

- [ ] Bordeaux is visible on primary buttons, focus rings, sidebar-active state, and the login brand badge in both light and dark modes.
- [ ] No tokens beyond `--primary` / `--primary-foreground` / `--ring` / `--sidebar-primary` / `--sidebar-primary-foreground` are project-customized.
- [ ] WCAG AA holds on the primary fill in both modes.
