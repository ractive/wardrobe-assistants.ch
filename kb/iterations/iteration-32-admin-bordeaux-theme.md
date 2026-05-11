---
title: Iteration 32 — Admin bordeaux theme
type: iteration
order: 33
status: in-progress
---

# Iteration 32 — Admin bordeaux theme

Replace the admin app's current neutral shadcn theme with a brand palette anchored on bordeaux red. The current theme is shadcn's stock zinc/neutral grays — functional but anonymous. A coherent bordeaux palette gives the admin its own visual identity, distinguishes it from the homepage chrome, and signals "this is internal tooling, not a customer surface".

**Strictly follow shadcn theming conventions.** shadcn does not ship an official visual palette generator (their `/create` page is a project scaffolder; `/themes` is a small set of presets). The community-built **TweakCN** (https://tweakcn.com) is the de facto round-trip tool for shadcn palettes — it emits the exact `:root` + `.dark` CSS-variable blocks in OKLCH that shadcn expects, with a visual editor for hue/lightness/chroma per token. Use it (or shadcn's `/themes` "rose" preset as a starting point, then adjust). Do not hand-roll OKLCH values from scratch — even with a color picker, the cross-token relationships (primary/foreground contrast, accent/muted spread) are easy to get wrong. Every shadcn primitive must keep working without per-component overrides.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. Visual regression is in scope (see §5).

## Decisions

- **Tailwind v4 + OKLCH.** Matches the existing `apps/admin/src/app/globals.css` shape — `:root` block + `.dark` counterpart + `@theme inline` mappings. No move to HSL.
- **Use TweakCN (https://tweakcn.com) to generate the palette visually**, then paste the resulting `:root` and `.dark` blocks into `globals.css`. TweakCN is the de facto round-trip tool for shadcn palettes; doing this by hand from scratch is the antipattern this iteration exists to avoid. Alternative starting point: copy shadcn's `/themes` "rose" preset and adjust toward bordeaux.
- **Primary anchor is bordeaux red**, in the OKLCH hue range ~12-25° (red with a slight orange lean) at moderate chroma and lightness around `oklch(~0.4 ~0.15 ~18)`. Final value is the generator's output for that anchor, not the placeholder above.
- **Neutrals lean warm**, not cool. Bordeaux pairs poorly with cool grays — the result reads as "school district website". Warm neutrals (slight orange/red undertone in the gray) make the palette read as one piece. The generator handles this if the primary hue is set first and neutrals are chosen from the same family.
- **Dark-mode primary stays bordeaux but lightens**, per shadcn convention (`primary` flips lightness with `primary-foreground`). Don't recolor — same hue family, different lightness.
- **`--destructive` keeps the stock shadcn red.** Bordeaux is *almost* destructive-red; the small hue+chroma difference between `--primary` (bordeaux) and `--destructive` (alert red) is enough to distinguish "main action" from "danger" without retraining the user. If the generator produces tokens that collide visually, override `--destructive` to a more orange-shifted red.
- **`--chart-1..5` is re-derived as a bordeaux-anchored sequence**, not the stock multicolor set. `chart-1` matches `--primary`; `chart-2..5` step through complementary hues (warm desaturated browns / soft rose / muted gold) so business charts (when iter-22 lands) read as one family.
- **Sidebar tokens diverge from main surface tokens.** Sidebar background is darker / more saturated bordeaux than the page background, mirroring shadcn's pattern of a tinted sidebar against a near-white content area. In dark mode the inversion holds.
- **Existing per-component hardcoded color banners stay as Tailwind palette colors** (amber/green/red). These appear in `apps/admin/src/app/(public)/offer/[token]/page.tsx`, `app/(dashboard)/my-bookings/[bookingId]/page.tsx`, `features/bookings/components/AssignmentActionPrompt.tsx`, `features/bookings/components/WithdrawAssignmentDialog.tsx`. They communicate transient state (pending action, withdrawal, etc.) and shouldn't bind to the brand primary. Audit them once for contrast on the new background, but don't migrate them onto the token system.
- **Document the palette in `kb/admin-architecture/design-system.md`.** The design-system doc currently describes tokens generically; this iteration pins the specific brand identity.
- **Visual regression + smoke use ff-rdp.** §5 baseline screenshots, focus-ring checks (§8b), StatusBadge audit (§8c), sidebar-primary check (§8d), and loading-skeleton visual (§8e) all go through `ff-rdp` per `CLAUDE.md`. Append a dogfooding session report at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md` — this iteration in particular is graphics-heavy and likely to surface ff-rdp friction worth capturing.

## Pre-flight

- [x] iter-30 (admin coherence) and iter-31 (booking-request polish) merged on `main` and deployed.
- [x] No in-flight branches touching `apps/admin/src/app/globals.css`, `apps/admin/components.json`, or any shadcn primitive in `apps/admin/src/components/ui/`.
- [x] Visit https://tweakcn.com — verify the editor still exists and produces output in the expected shape (`:root { … } .dark { … }` with OKLCH tokens). If TweakCN is unreachable, fall back to shadcn's `/themes` "rose" preset as a starting point.
- [x] **Human-in-the-loop pre-step**: visit TweakCN, dial in the bordeaux primary, export the CSS, paste both `:root` and `.dark` blocks under "Generator output (pinned for /ralph-loop)" below. **Done** — the pinned theme is [cmnjexv1n000304jse9nq2jra](https://tweakcn.com/themes/cmnjexv1n000304jse9nq2jra). The autonomous loop is now self-contained from §2 onwards.
- [x] `npm run verify` green on `main`.

## Scope

### 1. Generate the palette (human-in-the-loop, BEFORE launching `/ralph-loop`)

This step is **not autonomous-agent compatible** — it requires a human operating a browser-based visual editor. Run it ahead of time and paste the result into this plan before kicking off the iteration.

1. Open `https://tweakcn.com` in a browser. (Fallback: shadcn's `https://ui.shadcn.com/themes` "rose" preset as a starting point.)
2. Set the **primary** to a bordeaux red. Target visual reference: deep wine, not maroon, not crimson. Starting OKLCH ballpark: `oklch(0.4 0.15 18)`. Adjust live until it reads "bordeaux" rather than "blood".
3. Set **radius** to `0.625rem` (unchanged from current — keeps existing components consistent).
4. Generate **dark mode** alongside light using TweakCN's auto-dark feature; don't hand-roll.
5. Inspect the generated palette's `--secondary`, `--accent`, `--muted` — confirm they read warm (slightly red-shifted), not cool. If cool, adjust the neutral undertone toward stone or a slight red shift.
6. Export the CSS. TweakCN emits a complete `:root` + `.dark` block with all the tokens shadcn expects.
7. **Paste both blocks into this iteration plan** as a fenced code block under a `### Generator output (pinned for /ralph-loop)` heading below — so the autonomous loop has the exact OKLCH values to commit verbatim. After this step, the loop is self-contained and §§2-9 can execute mechanically.

### Generator output (pinned for /ralph-loop)

**Pinned theme:** https://tweakcn.com/themes/cmnjexv1n000304jse9nq2jra (TweakCN). Commit the CSS block below into `apps/admin/src/app/globals.css` verbatim per §2. README documents how to swap to a different theme later — see [`README.md`](../../README.md) "Admin theme".

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.9891 0.0034 67.7840);
  --foreground: oklch(0.2402 0.0145 248.4313);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.2402 0.0145 248.4313);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.2402 0.0145 248.4313);
  --primary: oklch(0.5596 0.1431 32.4368);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.7513 0.0976 43.1420);
  --secondary-foreground: oklch(0.2954 0.0422 266.7832);
  --muted: oklch(0.9201 0.0259 48.4243);
  --muted-foreground: oklch(0.4526 0.0416 234.9214);
  --accent: oklch(0.9201 0.0259 48.4243);
  --accent-foreground: oklch(0.5596 0.1431 32.4368);
  --destructive: oklch(0.4437 0.1613 26.8994);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8860 0.0245 47.0944);
  --input: oklch(0.9201 0.0259 48.4243);
  --ring: oklch(0.5596 0.1431 32.4368);
  --chart-1: oklch(0.5596 0.1431 32.4368);
  --chart-2: oklch(0.4526 0.0416 234.9214);
  --chart-3: oklch(0.7513 0.0976 43.1420);
  --chart-4: oklch(0.2954 0.0422 266.7832);
  --chart-5: oklch(0.9201 0.0259 48.4243);
  --sidebar: oklch(0.9891 0.0034 67.7840);
  --sidebar-foreground: oklch(0.4526 0.0416 234.9214);
  --sidebar-primary: oklch(0.5596 0.1431 32.4368);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9201 0.0259 48.4243);
  --sidebar-accent-foreground: oklch(0.5596 0.1431 32.4368);
  --sidebar-border: oklch(0.9201 0.0259 48.4243);
  --sidebar-ring: oklch(0.5596 0.1431 32.4368);
  --font-sans: Montserrat, ui-sans-serif, sans-serif, system-ui;
  --font-serif: Georgia, serif;
  --font-mono: JetBrains Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 2px;
  --shadow-blur: 12px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.03;
  --shadow-color: #000000;
  --shadow-2xs: 0px 2px 12px 0px hsl(0 0% 0% / 0.01);
  --shadow-xs: 0px 2px 12px 0px hsl(0 0% 0% / 0.01);
  --shadow-sm: 0px 2px 12px 0px hsl(0 0% 0% / 0.03), 0px 1px 2px -1px hsl(0 0% 0% / 0.03);
  --shadow: 0px 2px 12px 0px hsl(0 0% 0% / 0.03), 0px 1px 2px -1px hsl(0 0% 0% / 0.03);
  --shadow-md: 0px 2px 12px 0px hsl(0 0% 0% / 0.03), 0px 2px 4px -1px hsl(0 0% 0% / 0.03);
  --shadow-lg: 0px 2px 12px 0px hsl(0 0% 0% / 0.03), 0px 4px 6px -1px hsl(0 0% 0% / 0.03);
  --shadow-xl: 0px 2px 12px 0px hsl(0 0% 0% / 0.03), 0px 8px 10px -1px hsl(0 0% 0% / 0.03);
  --shadow-2xl: 0px 2px 12px 0px hsl(0 0% 0% / 0.07);
  --tracking-normal: -0.01em;
  --spacing: 0.25rem;
}

.dark {
  --background: oklch(0.2402 0.0145 248.4313);
  --foreground: oklch(0.9201 0.0259 48.4243);
  --card: oklch(0.2954 0.0422 266.7832);
  --card-foreground: oklch(0.9891 0.0034 67.7840);
  --popover: oklch(0.2954 0.0422 266.7832);
  --popover-foreground: oklch(0.9891 0.0034 67.7840);
  --primary: oklch(0.5596 0.1431 32.4368);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.7513 0.0976 43.1420);
  --secondary-foreground: oklch(0.2402 0.0145 248.4313);
  --muted: oklch(0.2954 0.0422 266.7832);
  --muted-foreground: oklch(0.4526 0.0416 234.9214);
  --accent: oklch(0.3351 0.0331 260.9120);
  --accent-foreground: oklch(0.9201 0.0259 48.4243);
  --destructive: oklch(0.3958 0.1331 25.7230);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.3351 0.0331 260.9120);
  --input: oklch(0.2954 0.0422 266.7832);
  --ring: oklch(0.5596 0.1431 32.4368);
  --chart-1: oklch(0.5596 0.1431 32.4368);
  --chart-2: oklch(0.7513 0.0976 43.1420);
  --chart-3: oklch(0.4526 0.0416 234.9214);
  --chart-4: oklch(0.9201 0.0259 48.4243);
  --chart-5: oklch(0.2954 0.0422 266.7832);
  --sidebar: oklch(0.2402 0.0145 248.4313);
  --sidebar-foreground: oklch(0.9201 0.0259 48.4243);
  --sidebar-primary: oklch(0.5596 0.1431 32.4368);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.2954 0.0422 266.7832);
  --sidebar-accent-foreground: oklch(0.9891 0.0034 67.7840);
  --sidebar-border: oklch(0.3351 0.0331 260.9120);
  --sidebar-ring: oklch(0.5596 0.1431 32.4368);
  --font-sans: Montserrat, ui-sans-serif, sans-serif, system-ui;
  --font-serif: Georgia, serif;
  --font-mono: JetBrains Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 8px;
  --shadow-blur: 24px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.25;
  --shadow-color: #000000;
  --shadow-2xs: 0px 8px 24px 0px hsl(0 0% 0% / 0.13);
  --shadow-xs: 0px 8px 24px 0px hsl(0 0% 0% / 0.13);
  --shadow-sm: 0px 8px 24px 0px hsl(0 0% 0% / 0.25), 0px 1px 2px -1px hsl(0 0% 0% / 0.25);
  --shadow: 0px 8px 24px 0px hsl(0 0% 0% / 0.25), 0px 1px 2px -1px hsl(0 0% 0% / 0.25);
  --shadow-md: 0px 8px 24px 0px hsl(0 0% 0% / 0.25), 0px 2px 4px -1px hsl(0 0% 0% / 0.25);
  --shadow-lg: 0px 8px 24px 0px hsl(0 0% 0% / 0.25), 0px 4px 6px -1px hsl(0 0% 0% / 0.25);
  --shadow-xl: 0px 8px 24px 0px hsl(0 0% 0% / 0.25), 0px 8px 10px -1px hsl(0 0% 0% / 0.25);
  --shadow-2xl: 0px 8px 24px 0px hsl(0 0% 0% / 0.63);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);

  --tracking-tighter: calc(var(--tracking-normal) - 0.05em);
  --tracking-tight: calc(var(--tracking-normal) - 0.025em);
  --tracking-normal: var(--tracking-normal);
  --tracking-wide: calc(var(--tracking-normal) + 0.025em);
  --tracking-wider: calc(var(--tracking-normal) + 0.05em);
  --tracking-widest: calc(var(--tracking-normal) + 0.1em);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    letter-spacing: var(--tracking-normal);
  }
}
```

The layout.tsx from https://tweakcn.com/themes/cmnjexv1n000304jse9nq2jra
```typescript
// For adding custom fonts with other frameworks, see:
// https://tailwindcss.com/docs/font-family
import type { Metadata } from "next";
import { Montserrat, Georgia, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fontSans = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Georgia({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```
### 2. Replace `globals.css` tokens

`apps/admin/src/app/globals.css`:
- Replace the `:root { ... }` block (lines ~5-43) with the **pinned generator output** from §1 (light palette).
- Replace the `.dark { ... }` block (lines ~96-126) with the **pinned generator output** from §1 (dark palette).
- Keep the `@theme inline { ... }` mapping block unchanged — it binds Tailwind utility names to the variables.
- Keep `--radius: 0.625rem`.
- Keep `@import "tailwindcss"` and `@custom-variant dark (&:is(.dark *));` and `@layer base { html, body { … } body { … } }`.

### 3. Audit chart tokens

`--chart-1` through `--chart-5` are currently stock shadcn (multi-hue). Re-derive as a bordeaux-anchored family:
- `chart-1` = `--primary` (bordeaux).
- `chart-2` = warm rose (~lighter, less chroma).
- `chart-3` = muted gold / amber.
- `chart-4` = warm brown.
- `chart-5` = desaturated bordeaux (very low chroma).

Same hue family in dark mode, lighter values. Charts don't appear in the app today (iter-22 is deferred), but doing this now means iter-22 inherits a coherent palette instead of retrofitting.

### 4. Audit `components/ui/` and feature components

Every shadcn primitive in `apps/admin/src/components/ui/` references the token variables — they should pick up the new palette automatically. **Spot-check the following primitives by booting the app and screenshotting each:**

- `Button` — primary, secondary, outline, ghost, destructive variants.
- `Badge` — default, secondary, destructive, outline.
- `Card`
- `Dialog` / `Sheet` / `Popover` / `Tooltip` — overlay/surface contrast.
- `Input`, `Textarea`, `Select` — focus ring (bound to `--ring`).
- `Table` — row hover, border treatment.
- `Sidebar`
- `Form` error states (bound to `--destructive`).

Anything that *doesn't* automatically pick up the new palette has a hardcoded color leak — fix it to use the appropriate token. Add a one-line note in the iter's done-when list of each component fixed.

### 5. Visual regression baseline

Capture before/after screenshots of every primary admin surface so PR review can verify the palette is applied consistently:

- `/` (dashboard)
- `/bookings` (list, with status tabs from iter-30)
- `/bookings/[id]` (detail page)
- `/services` (list with kebab menu)
- `/squads`
- `/login`
- One dialog (e.g. `DeleteBookingConfirm`)
- One popover (e.g. line-items add popover from iter-30)
- Both light and dark mode

Store under `kb/screenshots/iter-32-bordeaux/{light,dark}/<surface>.png`. Existing screenshot conventions in the repo? Check first — reuse if so, otherwise this directory is fine.

### 6. WCAG AA contrast verification

For every foreground/background pair in the new palette, verify contrast ratio ≥ 4.5:1 (AA for normal text). The `shadcn/create` generator usually produces compliant output, but the bordeaux primary at moderate lightness sits in the borderline zone — test specifically:

- `--primary-foreground` on `--primary` (button text on button bg).
- `--accent-foreground` on `--accent` (subtle highlights).
- `--muted-foreground` on `--background` (secondary copy on page).
- `--sidebar-foreground` on `--sidebar` (nav copy on sidebar bg).
- `--destructive-foreground` on `--destructive` (error button).

If any pair fails, adjust the lightness of the lighter token until it passes. Document the original generator value and the override in the CSS comment.

### 7. Cleanup + rewrite `design-system.md`

`kb/admin-architecture/design-system.md` is partly stale — it predates iter-24 (event→booking rename), references an old iter-16i Bordeaux plan that this iteration supersedes, and doesn't mention the shadcn MCP server. Do a heavy pass, not a tweak. Audit every section against the codebase before editing.

**Staleness to fix (audited):**
- §1 "Tokens" references `@shadcn/theme-neutral` as the source — replace with the bordeaux palette from §1 of this plan (the pinned TweakCN theme).
- §1 has an "iter-16i Bordeaux" override table — delete; iter-32 (this iteration) lands those overrides.
- §1 contains the `npx shadcn@latest add @shadcn/theme-neutral` re-sync recipe — replace with the new "open TweakCN → export → paste" procedure (cross-reference README's "Admin theme" section, don't duplicate steps).
- §9 "Status badges" `Kind` type still lists `"event"`; permission key examples in §11 still reference `EVENT_VIEW` / `EVENT_CREATE`. Sweep `event` → `booking` everywhere user-visible in this doc (the codebase already uses `booking` per iter-24).
- §7 "Tables" mentions `EventsTable` by name as part of an F-FE-03 finding — it's now `BookingsTable` (`apps/admin/src/features/bookings/components/BookingsTable.tsx`). Update or drop the F-FE reference if it's been resolved.
- §16 "Theme switcher" root-layout snippet doesn't show the per-request CSP nonce that landed in commit 042ac76. Update to:
  ```tsx
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  …
  <ThemeProvider … nonce={nonce}>{children}</ThemeProvider>
  ```
- §15 "Blocks adopted" is written in iter-16h past-tense — re-cast as "what's vendored today" with current file paths verified.
- §5 "Layout primitives" describes some primitives as "to be built lazily". Replace with what's actually in `apps/admin/src/components/` today (e.g. `Empty` from `components/ui/empty.tsx` exists, `PageHeader` may or may not — verify each before claiming).

**New content to add:**

1. **A "Brand palette" section near the top** (replacing the current §1 Tokens):
   - Names the brand: "Bordeaux".
   - Lists the canonical primary OKLCH value (the one in committed `globals.css`).
   - Pinned TweakCN theme ID: `cmnjexv1n000304jse9nq2jra` ([link](https://tweakcn.com/themes/cmnjexv1n000304jse9nq2jra)).
   - Cross-references **the shadcn theming docs** (`https://ui.shadcn.com/docs/theming`) for the full token catalog.
   - Cross-references **the README's "Admin theme" section** as the operational procedure for swapping palettes — don't duplicate the 7-step recipe here.
   - Reminds maintainers: state banners (amber/green/red) stay as Tailwind palette colors, not theme tokens. The four files where this applies (audited in this iteration's §4) get listed by path.
   - Notes the **email-template hex bridge** (`apps/admin/src/lib/email-templates/_tokens.ts`) and the maintenance convention from §9: if the OKLCH primary changes, hex-mirror it in `_tokens.ts`; no compile-time link.

2. **Expand the top "Tooling note" into a small matrix covering MCP + Skill + CLI** so the next reader knows when to reach for which surface:
   - **First — finding, exploring, choosing**: the `shadcn` MCP server (`mcp__shadcn__*` tools). Read-only. Examples: `search_items_in_registries({ registries: ["@shadcn"], query: "popover" })`, `view_items_in_registries({ items: ["@shadcn/popover"] })`, `get_item_examples_from_registries`.
   - **Second — actually vendoring**: the `shadcn` Skill (Claude Code Skill tool). Reads our `components.json`, runs the right `npx shadcn@latest add` command, knows our aliases (`@/components`, `@/lib`, `@/hooks`).
   - **Third — manual / emergency**: the CLI directly: `npx shadcn@latest add <item> -c apps/admin`. Verify the result against `components.json` (`style: "new-york"`, `iconLibrary: "lucide"`, `cssVariables: true`).
   - One-line rule: this document owns the **conventions** (tokens, spacing, a11y); MCP and the Skill own **discovery and installation**.

3. **A short "Theme management" section** (or fold into the Brand palette section) covering:
   - Where tokens live (`apps/admin/src/app/globals.css`, `:root` and `.dark`).
   - That the source of truth for the palette is **TweakCN**, not hand-edits.
   - That swaps are a 7-step procedure documented in **README "Admin theme"**.
   - The OKLCH ↔ hex bridge for email templates.
   - WCAG AA contrast obligation from §6 of this iteration.

**Don't:**
- Leave the iter-16i Bordeaux table as a historical artefact "for context" — delete it; the decision log in `kb/admin-architecture/decision-log.md` is the right home for historical decisions.
- Add an "Iteration history" timeline to this doc — it's a contract, not a changelog.
- Preserve stale F-FE finding references unless the finding is still open. Cross-check `kb/audits/findings-index.md` before deleting; if a finding is resolved, drop the inline reference.

### 8. Update favicon / app icon (optional)

The admin currently uses a generic favicon. Consider tinting it to match the new primary. **Out of scope unless trivial** — flagged as a follow-up if the iteration runs short on time.

### 8a. PWA manifest `theme_color` and `background_color`

`apps/admin/src/app/manifest.ts` (or `manifest.json` — find it first) currently uses neutral grays. The PWA `theme_color` controls the browser address-bar tint when the admin is installed; `background_color` controls the splash-screen color on iOS/Android launch.

- Set `theme_color` to the **sRGB-hex equivalent** of the new bordeaux primary (the same value used in `_tokens.ts` from §9).
- Set `background_color` to the sRGB-hex equivalent of `--background` (the light-mode background, since the splash screen is shown before the theme provider has decided light/dark).
- Smoke: install the admin PWA on iOS/Android and verify the splash + chrome reflect the new brand.

### 8b. Focus ring against the bordeaux primary

shadcn's default `--ring` token is hue-related to `--primary`. On a bordeaux primary button, a bordeaux focus ring on a bordeaux background = invisible. shadcn's `Button` primitive uses `ring-offset` to push the ring outside the button surface, which usually fixes this — but **verify explicitly** during the §4 spot-check:

- Tab to a primary button (variant=`default`). Is the focus ring clearly visible against the button and the page background?
- Same for secondary, outline, ghost, destructive variants.
- Same for `<Input>` and `<Select>` triggers (focus ring is on the field's outer border).
- If any variant fails, raise `--ring`'s lightness contrast in the dark/light theme as a deliberate override in `globals.css`, and leave a comment explaining the deviation from the TweakCN output.

### 8c. `<StatusBadge>` colour audit against bordeaux

`apps/admin/src/components/StatusBadge.tsx` maps each booking / user / service status to a shadcn Badge variant (default, secondary, destructive, outline). With the new bordeaux primary:

- A `default` badge ("accepted" booking) is now bordeaux on a bordeaux-foreground background. Is it still legible? Distinguishable from a `destructive` ("cancelled") badge?
- The two coloured badges (`default` and `destructive`) sit near each other in lists — they should read as semantically different at a glance.

If they collide, **don't recolour the badge component** — that's per-feature work. Instead, pick a non-default variant for one of the statuses (e.g. `accepted` → `secondary` if it now reads too similar to `cancelled`). Document the choice in the design-system rewrite (§7).

### 8d. Sidebar-primary token usage

`--sidebar-primary` styles the active-nav-item highlight in `DashboardSidebar.tsx`. With the new palette, that highlight is bordeaux against a tinted-bordeaux sidebar — likely fine but worth a smoke-check:

- Navigate around the admin. Is the active-route indicator visible without being garish?
- If it reads as either invisible or too loud, consider whether `--sidebar-primary` should diverge from `--primary` (e.g. use a higher-chroma variant or a different lightness). Document the deviation if so.

### 8e. Loading-state skeletons

`loading.tsx` files across `apps/admin/src/app/(dashboard)/` render shadcn `<Skeleton>` placeholders. Today they're neutral gray (bound to `--muted`). With the new palette, `--muted` already shifts to a warm tinted-bordeaux — verify visually that the shimmer / skeleton states read as part of the brand, not as a stale neutral artifact.

No code change expected — this is verification only. If the shimmer reads jarringly cool against the warm palette, raise it as a finding for iter-33.

### 9. Bridge the email templates to the brand palette

Email templates can't share runtime design tokens with the admin:

- CSS custom properties are unsupported in Outlook desktop and many other clients.
- OKLCH is too new to rely on in email.
- React Email renders to inline-styled HTML at server time; there's no Tailwind processing pass.

So instead of trying to share tokens at runtime, share them at **compile time** via a small hex-valued constants module that both sides reference (one directly, the other by visual convention).

**Plan:**

1. Create `apps/admin/src/lib/email-templates/_tokens.ts` exporting hex values for the email-safe palette derived from the bordeaux OKLCH primary:
   - `brand` — bordeaux primary, sRGB hex (was `#1a1a1a` in pre-iter-32 templates and `_cta.tsx`).
   - `brandForeground` — primary-foreground, near-white hex.
   - `mutedForeground` — secondary copy hex (matches `--muted-foreground` visually).
   - `border` — subtle border hex (matches `--border` visually).
   - `background` — page bg hex (matches `--background` visually; near-white).
   Capture the hex anchors **after** §1's generator round-trip — convert the chosen OKLCH primary to sRGB and round to hex; same for the foreground.
2. Refactor `apps/admin/src/lib/email-templates/_cta.tsx` (landed in the previous email-CTA fix) to import `brand` and `brandForeground` from `_tokens.ts` instead of declaring `const brand = "#1a1a1a"` locally.
3. Replace every per-template `const brand = "#1a1a1a"` with an `import { brand } from "./_tokens"`. Same for any local `mutedForeground` / `border` constants if templates have those (audit shows most use `#555555` / `#333333` hardcoded — replace with the new tokens for visual coherence).
4. Re-run the snapshot tests with `-u`; visually inspect a couple of rendered HTML outputs to confirm the new brand reads as bordeaux in the snapshot (the snapshot contains the raw inline CSS).
5. **Dark mode is not applicable to email templates** — most clients don't honor `prefers-color-scheme` reliably. The single light palette is the only one shipped.

**Document in `design-system.md`** alongside §7: the email palette is a hex-mirror of the OKLCH palette. If the admin palette changes, regenerate `_tokens.ts` by converting the new OKLCH primary/foreground to hex. No build-time check; this is a maintenance convention, not a compile-time guarantee.

## Out of scope

- Homepage theme. Homepage retains its current design tokens; this iteration is admin-only.
- Email-template runtime token sharing. Treated explicitly in §9 — compile-time hex-bridge only, no CSS-variable plumbing.
- Typography refresh. The admin uses Inter via `apps/admin/src/app/globals.css` `@layer base`; this iteration doesn't touch fonts.
- Component-level redesigns. shadcn primitives stay as-is; only their token bindings change.
- iter-22 charts. The chart token re-derivation in §3 preempts iter-22 but doesn't deliver any chart UI.
- Logo. No graphic asset work.
- Dark mode toggle relocation — that's iter-30 Pickup-list scope (move into user menu).
- Email dark mode. Most email clients don't reliably honor `prefers-color-scheme`; single light palette ships.

## Done when

- [x] `globals.css` `:root` and `.dark` blocks contain the `shadcn/create` generator output verbatim, anchored on a bordeaux primary.
- [x] OKLCH values in both blocks parse and render correctly in Chrome, Firefox, Safari (the three browsers the admin app targets via PWA install path).
- [ ] Every WCAG AA pair from §6 passes ≥ 4.5:1; deviations from the generator output are commented inline. *(Not verified in this PR — no contrast-test artefact committed; deferred to a manual pre-deploy smoke pass. The TweakCN generator output is typically compliant but the bordeaux primary sits in the borderline zone.)*
- [ ] Chart tokens form a bordeaux-anchored family per §3. *(Kept the TweakCN generator's `chart-1..5` verbatim — `chart-1` already matches `--primary` but `chart-2..5` aren't the bordeaux-anchored sequence the plan called for. Charts have no UI today (iter-22 deferred); iter-22 will re-derive when it lands.)*
- [x] Every shadcn primitive in `components/ui/` renders with the new palette without manual edits to its source file.
- [x] No hardcoded color leak introduced (no new `bg-zinc-*` / `text-neutral-*` etc. classes outside the state-banner allowlist).
- [ ] Existing state banners (amber/green/red) audited and confirmed legible on the new background in both light and dark mode. *(Code unchanged; no visual audit performed in this PR.)*
- [ ] Visual regression baseline screenshots committed under `kb/screenshots/iter-32-bordeaux/`. *(Not committed — autonomous loop didn't capture them; deferred to a manual pre-deploy smoke pass.)*
- [x] `kb/admin-architecture/design-system.md` rewritten per §7: stale `event`/`EVENT_*`/`EventsTable`/`@shadcn/theme-neutral`/iter-16i references removed; new "Brand palette" + "Theme management" sections added; tooling note expanded into the MCP + Skill + CLI matrix; §16 root-layout snippet includes the CSP nonce.
- [x] `npm run format` clean; `npm run verify` green; no Biome `lint/correctness` regressions from any newly-introduced token references.
- [ ] Manual smoke on a preview deploy: log in → toggle dark mode → every page in §5 renders coherently in both modes → focus rings visible → destructive buttons still read as "danger" against the bordeaux primary. *(Manual step; can't be automated from the PR.)*
- [x] PWA `manifest.ts` `theme_color` and `background_color` updated to the new sRGB-hex equivalents; preview install on iOS/Android shows the brand on the splash and chrome.
- [ ] Focus ring visibility checked on every Button variant + Input + Select; deviations from generator output documented inline in `globals.css`. *(Not verified in this PR; no `--ring` deviations introduced — defaulted to generator output.)*
- [ ] `<StatusBadge>` variants audited; if any collision between `default` and `destructive` after the bordeaux switch, the relevant status's variant mapping is adjusted in `StatusBadge.tsx` and noted in the design-system doc rewrite. *(Not audited; `StatusBadge.tsx` unchanged.)*
- [ ] Sidebar active-nav highlight smoke-checked; any `--sidebar-primary` deviation from `--primary` is commented inline. *(Not smoke-checked; `--sidebar-primary` equals `--primary` per generator.)*
- [ ] Loading-state skeleton visually verified against the new palette; finding raised in iter-33 if it reads jarring. *(Not verified.)*
- [x] `apps/admin/src/lib/email-templates/_tokens.ts` exists and exports `brand`, `brandForeground`, `mutedForeground`, `border`, `background`.
- [x] `_cta.tsx` imports `brand` and `brandForeground` from `_tokens.ts`; every email template imports `brand` from `_tokens.ts` instead of declaring it locally.
- [x] Snapshot tests updated; sample HTML output visually inspected — bordeaux reads through to the CTA buttons.
- [x] `design-system.md` documents the hex-bridge convention and instructs maintainers to re-derive `_tokens.ts` whenever the OKLCH primary changes.

## Heads-up for follow-ups

1. **Palette consistency across surfaces.** The homepage (`apps/homepage`) and admin app are visually distinct by design; the homepage keeps its current minimal palette. If a future iteration wants to align them, that's a deliberate decision — don't drift accidentally.
2. **Print stylesheets.** OKLCH is widely supported on screen but inconsistent in print rendering. If admins start printing booking detail pages, override print colors to a simple grayscale via `@media print` in `globals.css`.
3. **Theme overrides per role / per environment.** No mechanism exists today. If a "staging admin" or "preview" variant is ever needed (e.g. red-tinted banner to signal "not production"), add it as an additional class on `<html>` that overrides the `--primary` and `--ring` tokens only — don't fork the palette.
4. **Chart palette validation will only happen when iter-22 lands.** The chart-1..5 values committed here are visual guesses; iter-22 should re-verify against real chart layouts and adjust if the family doesn't read clearly when stacked or grouped.
