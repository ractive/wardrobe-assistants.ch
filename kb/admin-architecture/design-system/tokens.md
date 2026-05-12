---
title: Tokens
type: architecture
status: current
---

# Brand palette

The admin's brand is **Bordeaux** — a deep wine-red primary anchoring a warm-neutral palette, generated via [**TweakCN**](https://tweakcn.com) and pinned at theme [`cmnjexv1n000304jse9nq2jra`](https://tweakcn.com/themes/cmnjexv1n000304jse9nq2jra) (iter-32). TweakCN is the de facto round-trip tool for shadcn palettes; the admin treats it as the source of truth.

Tokens follow the shadcn theming contract — see [shadcn theming docs](https://ui.shadcn.com/docs/theming) for the canonical token catalog (`--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, `--sidebar*`, `--chart-1..5`). The full OKLCH values for both light (`:root`) and dark (`.dark`) modes live in `apps/admin/src/app/globals.css`. Canonical primary: `oklch(0.5596 0.1431 32.4368)`.

To swap palettes: open TweakCN → export both blocks → paste into `globals.css`. The full procedure is documented in **[README "Admin theme"](../../../README.md#admin-theme)** — don't duplicate it here.

**State banners stay as Tailwind palette colors**, not theme tokens. Amber/green/red banners communicate transient state (pending, withdrawn, etc.) and must not bind to `--primary`. The four current call-sites are:

- `apps/admin/src/app/(public)/offer/[token]/page.tsx`
- `apps/admin/src/app/(dashboard)/my-bookings/[bookingId]/page.tsx`
- `apps/admin/src/features/bookings/components/AssignmentActionPrompt.tsx`
- `apps/admin/src/features/bookings/components/WithdrawAssignmentDialog.tsx`

These are the only allowed Tailwind palette colours outside `components/ui/`. Audit on contrast after any palette swap; do not migrate them onto the token system.

**Email-template hex bridge.** Email clients don't support CSS custom properties or OKLCH reliably, so `apps/admin/src/lib/email-templates/_tokens.ts` exports the same brand as sRGB hex (`brand`, `brandForeground`, `mutedForeground`, `border`, `background`). If the OKLCH primary changes, convert the new values to hex and update `_tokens.ts` — this is a maintenance convention, not a compile-time link. See README "Admin theme" step 5.

**Don't:**
- Hex literals (`#…`) in components or pages under `apps/admin/src/`. Always `var(--…)` or a Tailwind-mapped token (`bg-card`, `text-muted-foreground`, etc.). The token *definitions* in `apps/admin/src/app/globals.css` are the only allowed hex literals — that's where the palette lives. Vendored shadcn files in `components/ui/` are also exempt (Biome already excludes that path). The email-template tokens are a deliberate exception, scoped to `lib/email-templates/`.
- Inventing new tokens. If you need a colour not covered by the shadcn token catalog, raise it in the decision log and add a token; don't inline a hex.

**Contrast note (F-FE-27):** `--muted-foreground` on `--background` is borderline WCAG AA at small sizes. Reserve `text-muted-foreground` for help/caption (`text-xs`/`text-sm` non-essential). Do not use it for body copy that conveys primary information; use `--foreground` instead.

## Theme management

- **Source of truth**: TweakCN (the pinned theme above), exported and pasted into `apps/admin/src/app/globals.css`. Not hand-edited.
- **Where tokens live**: the `:root` and `.dark` blocks in `globals.css`. The `@theme inline { … }` block maps them to Tailwind utility names — leave it alone when swapping palettes.
- **Swap procedure**: the 7-step recipe in [README "Admin theme"](../../../README.md#admin-theme). Re-derive `_tokens.ts` in step 5.
- **WCAG AA obligation**: every foreground/background pair (`--primary-foreground`/`--primary`, `--accent-foreground`/`--accent`, `--muted-foreground`/`--background`, `--sidebar-foreground`/`--sidebar`, `--destructive-foreground`/`--destructive`) must hit ≥ 4.5:1. If a TweakCN export falls short, deviate the lighter token's lightness up and **comment the deviation inline in `globals.css`** so the next swap retains the override.
- **PWA chrome**: `apps/admin/src/app/manifest.ts` carries the brand twice — `theme_color` mirrors `--primary` as sRGB hex (browser address-bar tint) and `background_color` mirrors `--background` (PWA splash). Update both when the OKLCH primary changes.

---

See also: [design-system index](README.md) · [overview](../overview.md) · [a11y baseline](a11y.md) (contrast obligations) · [theme switcher](theme.md)
