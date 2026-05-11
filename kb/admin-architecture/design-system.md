---
title: Admin design system
type: architecture
status: current
---

# Admin design system

The contract for **how UI is built in `apps/admin/`**. Read this before adding a new page, form, table, or component, and before reviewing one. iter-16d/e/g and iter-17/18 reference this doc as the single source of truth — if a topic isn't covered here, write it down here before fixing it in code.

The audience is admins managing events from their phones — **mobile is the primary surface, not an afterthought.** Every section has a mobile-first answer first, the desktop answer second, and an anti-pattern to avoid.

Companion docs: [`overview.md`](overview.md) (architecture rules), [`feature-slice-template.md`](feature-slice-template.md) (file-by-file checklist), [`ui-stack.md`](ui-stack.md) (library inventory).

> **Tooling matrix (when working in `apps/admin/`):**
>
> 1. **First — finding / exploring / choosing** — the `shadcn` **MCP server** (`mcp__shadcn__*` tools). Read-only. Examples: `search_items_in_registries({ registries: ["@shadcn"], query: "popover" })`, `view_items_in_registries({ items: ["@shadcn/popover"] })`, `get_item_examples_from_registries`. Use this to discover what's available before reaching for anything else.
> 2. **Second — actually vendoring** — the `shadcn` **Claude Code Skill**. It reads our `components.json` (`style: "new-york"`, `iconLibrary: "lucide"`, `cssVariables: true`), runs the right `npx shadcn@latest add` command, and knows our aliases (`@/components`, `@/lib`, `@/hooks`).
> 3. **Third — manual / emergency** — the CLI directly: `npx shadcn@latest add <item> -c apps/admin`. Verify the result against `components.json` afterwards.
>
> One-line rule: **this document owns the conventions** (tokens, spacing, a11y, etc.); MCP and the Skill own discovery and installation.

## 1. Brand palette

The admin's brand is **Bordeaux** — a deep wine-red primary anchoring a warm-neutral palette, generated via [**TweakCN**](https://tweakcn.com) and pinned at theme [`cmnjexv1n000304jse9nq2jra`](https://tweakcn.com/themes/cmnjexv1n000304jse9nq2jra) (iter-32). TweakCN is the de facto round-trip tool for shadcn palettes; the admin treats it as the source of truth.

Tokens follow the shadcn theming contract — see [shadcn theming docs](https://ui.shadcn.com/docs/theming) for the canonical token catalog (`--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, `--sidebar*`, `--chart-1..5`). The full OKLCH values for both light (`:root`) and dark (`.dark`) modes live in `apps/admin/src/app/globals.css`. Canonical primary: `oklch(0.5596 0.1431 32.4368)`.

To swap palettes: open TweakCN → export both blocks → paste into `globals.css`. The full procedure is documented in **[README "Admin theme"](../../README.md#admin-theme)** — don't duplicate it here.

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

### Theme management

- **Source of truth**: TweakCN (the pinned theme above), exported and pasted into `apps/admin/src/app/globals.css`. Not hand-edited.
- **Where tokens live**: the `:root` and `.dark` blocks in `globals.css`. The `@theme inline { … }` block maps them to Tailwind utility names — leave it alone when swapping palettes.
- **Swap procedure**: the 7-step recipe in [README "Admin theme"](../../README.md#admin-theme). Re-derive `_tokens.ts` in step 5.
- **WCAG AA obligation**: every foreground/background pair (`--primary-foreground`/`--primary`, `--accent-foreground`/`--accent`, `--muted-foreground`/`--background`, `--sidebar-foreground`/`--sidebar`, `--destructive-foreground`/`--destructive`) must hit ≥ 4.5:1. If a TweakCN export falls short, deviate the lighter token's lightness up and **comment the deviation inline in `globals.css`** so the next swap retains the override.
- **PWA chrome**: `apps/admin/src/app/manifest.ts` carries the brand twice — `theme_color` mirrors `--primary` as sRGB hex (browser address-bar tint) and `background_color` mirrors `--background` (PWA splash). Update both when the OKLCH primary changes.

## 2. Breakpoints + responsive baseline

Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px. **Admin must work at 375px width (iPhone SE class) and up.**

**Mobile-first answer:** write base classes for the 375–640px range, then add wider-screen variants. The cascade direction is the rule, not specific class pairs: write the mobile baseline first, then narrow/widen at `md:` / `lg:`. e.g. `flex-col md:flex-row` (mobile stacks, desktop inlines), `w-full md:w-auto` (full-width button on mobile, intrinsic on desktop), `grid-cols-1 md:grid-cols-2`. Touch targets are ≥ 44×44 px (Tailwind `min-h-11 min-w-11`).

**Desktop answer:** progressively widen with `md:` and `lg:` variants. The single column on mobile becomes a two-column grid at `md:`; the bottom-stack action row becomes inline at `md:`.

**Don't:**
- `md:flex-col` paired with a base `flex-row` (desktop-first) — inverts the intended cascade. Always start at mobile and add `md:`/`lg:` to widen, never the other way around.
- Anything that's only legible above `md`. If you can't see it on iPhone SE, it's broken.
- Touch targets below 44×44 — fingers aren't pixels.

## 3. Spacing

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

## 4. Typography

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

## 5. Layout primitives (signatures)

What's actually in `apps/admin/src/components/` today. Add new layout primitives here as they're lifted from inline code.

```tsx
// PageHeader — every dashboard page top
// apps/admin/src/components/PageHeader.tsx
type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode; // mobile: stacks below; md: inline-right
};
```

**Empty state:** the canonical **`@shadcn/empty`** primitive is vendored at `apps/admin/src/components/ui/empty.tsx`. Registry source: [`https://ui.shadcn.com/r/empty`](https://ui.shadcn.com/r/empty). Used by the dashboard chart placeholder and the recent-bookings empty state.

**Mobile-first answer:** `<PageHeader>` stacks `actions` below the title at base width, inlines them at `md:`. `<Empty>` centres its content; CTA is full-width on mobile.

**Desktop answer:** `actions` floats right of the title; `<Empty>` keeps centred content but caps width.

**Don't:**
- Building these primitives until a slice needs them — premature.
- Hand-rolling an empty-state component — use `<Empty>` from `@/components/ui/empty`.
- Inventing alternative slot names — stick to `title / description / actions / icon / action`.

## 6. Forms

shadcn `<Form>` + `<FormField>` + `<FormControl>` + `<FormMessage>` is the only allowed shape. `react-hook-form` + `zodResolver` ties the form to the same Zod schema the server action uses (see [`feature-slice-template.md`](feature-slice-template.md) for the canonical form).

| Concern | Rule |
|---|---|
| Layout | Single column on mobile; `md:grid-cols-2` for two-column on desktop |
| Field width | Always `w-full` on `<Input>`, `<Textarea>`, `<Select>` triggers |
| Submit button | Full-width on mobile (`w-full md:w-auto`) |
| Submit lock | `disabled={form.formState.isSubmitting}` always |
| Field-level errors | `<FormMessage />` (auto-wired via `<FormField>`) |
| Form-level server errors | Live region: `role="alert" aria-live="assertive"` on the wrapper containing the message |
| Touch targets | Inputs and submit ≥ 44px tall (shadcn defaults are 36px → bump to `h-11` on mobile) |
| Server-action result | `result?.error` → `toast.error(message)`; success → `toast.success(message)` |

```tsx
// form-level server error pattern
{serverError ? (
  <div role="alert" aria-live="assertive" className="text-sm text-destructive">
    {serverError}
  </div>
) : null}
```

**Mobile-first answer:** one column, full-width inputs, full-width submit, `space-y-4` between fields.

**Desktop answer:** `md:grid-cols-2 md:gap-x-4` for the form grid; submit floats right (`md:w-auto md:ml-auto`).

**Don't:**
- Raw `<input>`, `<select>`, `<textarea>` — always shadcn primitives.
- Validation logic outside Zod — every constraint lives in `schema.ts` and is reused server-side.
- Submitting on field blur — explicit submit only.

## 7. Tables — responsive strategy

Tables with **>3 columns** must render as **stacked cards on mobile, table on desktop**. Tables with **≤3 columns** can stay as a horizontal-scrolling table.

```tsx
// Tables wider than 3 columns:
<div className="md:hidden space-y-3">
  {rows.map((row) => (
    <Card key={row.id} className="p-4">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Name</dt><dd>{row.name}</dd>
        <dt className="text-muted-foreground">Role</dt><dd>{row.role}</dd>
        <dt className="text-muted-foreground">Status</dt><dd>{row.status}</dd>
      </dl>
      <div className="mt-3 flex justify-end"><RowActions row={row} /></div>
    </Card>
  ))}
</div>
<Table className="hidden md:table">…desktop table…</Table>
```

The mobile card is a label-value `<dl>` — accessible, scannable, no horizontal scroll.

**TanStack Table.** Do **not** introduce `@tanstack/react-table` for read-only data. Only adopt it if the page genuinely needs sorting, multi-column filtering, or client-side pagination, and document the justification in the iteration plan. The current `BookingsTable` (`apps/admin/src/features/bookings/components/BookingsTable.tsx`) is a plain `<Table>`.

**Mobile-first answer:** stacked cards.

**Desktop answer:** `<Table>` with `aria-label="<entity> list"` and `<TableCaption>` hidden visually but present for SR.

**Don't:**
- A wide `<Table>` with `overflow-x-auto` as the only mobile concession — squinting and scrolling.
- TanStack Table for static lists.
- Mixing card and table renderers under the same breakpoint — pick one per breakpoint.

## 8. Dialogs vs sheets on mobile

Long or form-shaped content gets a **`Sheet`** (bottom-anchored on mobile, side-anchored on desktop). Quick confirms (delete, archive) stay as **`Dialog`** at all sizes.

| Pattern | Use |
|---|---|
| `Dialog` | Confirms (delete, archive), 1–2 line copy + Cancel/Confirm |
| `Sheet` (`side="bottom"` on mobile, `side="right"` on desktop) | Forms, multi-field edits, anything taller than ~50% of viewport |

Destructive `Dialog`s **disable Esc-to-close while pending** (`onEscapeKeyDown={(e) => isPending && e.preventDefault()}`) — intentional, prevents an accidental dismiss while the request is in flight.

**Mobile-first answer:** `Sheet side="bottom"` for forms; takes ≥ 60% of viewport height with safe-area padding.

**Desktop answer:** `Sheet side="right"` for forms; `Dialog` centred for confirms.

**Don't:**
- Forms inside `Dialog` on mobile — they get cut off and behave badly with the soft keyboard.
- Allowing Esc-to-close on a destructive action mid-flight.

## 9. Status badges

One shared component (`apps/admin/src/components/StatusBadge.tsx`), per-`kind` variant maps mirrored from each feature's `schema.ts` (cross-feature imports are forbidden, so the maps are inlined here).

```tsx
// Sketch — the live file maps booking / user / serviceType / serviceStatus / assignment.
type StatusByKind = {
  booking: "created" | "offered" | "accepted" | "rejected" | "cancelled";
  user: "invited" | "verified";
  serviceStatus: "active" | "archived";
  // …
};
type BadgeVariant = "default" | "outline" | "secondary";

const VARIANTS: { [K in keyof StatusByKind]: Record<StatusByKind[K], { label: string; variant: BadgeVariant }> } = {
  booking: {
    created: { label: "Created", variant: "outline" },
    offered: { label: "Offered", variant: "default" },
    accepted: { label: "Accepted", variant: "default" },
    rejected: { label: "Rejected", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "secondary" },
  },
  // …
};
```

**Bordeaux palette note (iter-32).** Under the bordeaux primary, a `default` badge (e.g. accepted booking) and a `destructive` badge (e.g. cancelled) sit visually close because both are red-family. The current `StatusBadge.tsx` deliberately maps `cancelled` and `rejected` to `secondary` (not `destructive`) so the two coloured states (`default` bordeaux, `outline` neutral, `secondary` muted) read as distinct at list-scan distance. Don't introduce a `destructive` badge variant on the booking statuses without re-auditing this trade-off.

**Mobile-first answer:** identical to desktop.

**Desktop answer:** identical.

**Don't:**
- Per-feature `RoleBadge` / `StatusBadge` / `EventStatusBadge` files all doing the same thing — consolidate.
- Encoding state purely with colour — keep the text label inside the badge for SR users and colour-blind admins.

## 10. Icons

`lucide-react` everywhere. shadcn already wires it via `components.json`.

| Position | Class |
|---|---|
| Inline (next to text) | `size-4` |
| Button-leading (icon before button label) | `size-4` (default; `size-5` only when the button is `lg`) |
| Standalone tap target | wrap in a `size-11` interactive element so the touch target is ≥ 44×44 |

All icons in interactive context (buttons, links, dropdowns) get `aria-hidden="true"` plus a sibling text label or an `aria-label` on the wrapper. **No Unicode dingbats** (✓ ✗ ➜ ⚠️) — they crash screen readers and bypass our typographic scale (F-FE-23).

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

## 11. Permission gating

Server `<HasPermission perm="…">` is the **authoritative** gate — it runs in the RSC and refuses to render the children if the user lacks the permission. Client-side `useHasPermission("…")` is a **UI hint only**: it hides a menu item or disables a button to keep the surface tidy, but server actions and queries each gate independently via `withPermission` (see [`auth-and-permissions.md`](auth-and-permissions.md)).

Permission keys are entity-scoped:

| Key shape | Use | Examples |
|---|---|---|
| `<ENTITY>_VIEW` | Reads (list, detail) | `BOOKING_VIEW` |
| `<ENTITY>_CREATE` | Creates | `BOOKING_CREATE`, `SERVICE_CREATE` |
| `<ENTITY>_UPDATE` | Updates | — |
| `<ENTITY>_DELETE` | Deletes | `BOOKING_DELETE`, `USER_DELETE` |
| `<ENTITY>_<ACTION>` | Domain verbs | `USER_INVITE`, `USER_MESSAGE`, `BOOKING_ASSIGN`, `BOOKING_OFFER_SEND` |

**Never reuse a write permission to gate a read.** F-FE-08 records the precedent: a write permission was used to gate a detail page, which silently hid the entity from users who could legitimately *view* it. The fix is a dedicated `<ENTITY>_VIEW`.

**Mobile-first answer:** identical to desktop — gates run on the server.

**Desktop answer:** identical.

**Don't:**
- Branching on `role` directly — use the permission catalog.
- Client-side `useHasPermission` as the only gate — server-side `<HasPermission>` or `withPermission` is required for anything that fetches or mutates data.
- Reusing a write permission as a view gate.

## 12. A11y baseline

| Concern | Rule |
|---|---|
| Component tests | Every interactive component gets a `vitest-axe` `toHaveNoViolations()` assertion |
| Tables | `aria-label="<entity> list"` on `<Table>` |
| Active nav | `aria-current="page"` on the matching link |
| Form-level server errors | Live region: `role="alert" aria-live="assertive"` |
| Touch targets | ≥ 44×44 px on every interactive element |
| Reduced motion | Wrap CSS transitions in `motion-safe:` |
| Focus visible | `focus-visible:` ring is shadcn's default — don't override |
| Colour contrast | Core text tokens (`--foreground`, `--primary-foreground`) meet WCAG AA on `--background` — don't fight them with custom tints. **Exception:** `--muted-foreground` is borderline AA at small sizes; reserve it for non-essential help/captions per the contrast note in §1. |

```tsx
// vitest-axe smoke shape
import { axe } from "vitest-axe";
import { render } from "@testing-library/react";

it("InviteUserForm is accessible", async () => {
  const { container } = render(<InviteUserForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

**Mobile-first answer:** identical — accessibility scales across device class.

**Desktop answer:** identical.

**Don't:**
- Skipping the axe assertion on "simple" components — they're the ones that drift.
- Live regions on success toasts (sonner already handles politeness).

## 13. Animation

Default transition is `transition-colors duration-200`. Reserve longer or fancier transitions for one-off cases; document them in the component's comment.

Always wrap any animation-related class in the `motion-safe:` Tailwind variant so users with `prefers-reduced-motion: reduce` get a still UI.

```tsx
<button
  className="motion-safe:transition-colors motion-safe:duration-200 hover:bg-secondary"
>
```

**Mobile-first answer:** identical.

**Desktop answer:** identical.

**Don't:**
- Animating layout (`width`, `height`, `top/left`) — only colour, opacity, transform.
- Transitions longer than 200ms without a documented reason.
- Animations without `motion-safe:`.

## 14. Anti-patterns

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

## 15. Blocks adopted

Shadcn blocks vendored today. See [ui-stack.md §Blocks](ui-stack.md) and [`https://ui.shadcn.com/blocks`](https://ui.shadcn.com/blocks).

| Block | How used |
|---|---|
| `@shadcn/sidebar-07` | Grafted into `apps/admin/src/components/DashboardSidebar.tsx` — icon-collapse on desktop, offcanvas on mobile, footer with user menu + theme toggle, grouped nav. `<HasPermission>` gates around each link. |
| `@shadcn/login-03` | Chrome only: muted-bg full-screen flex shell, `max-w-sm` column, `<BrandBadge>` above the form. Form bodies are local components. |
| `@shadcn/dashboard-01` | Layout reference only; not vendored. Hand-written `(dashboard)/page.tsx` matches its KPI grid (1×4 mobile → 2×2 `md:` → 4×1 `xl:`) + chart placeholder + recent-bookings split, without pulling in the `@dnd-kit/*`, `recharts`, `@tabler/icons-react`, `@tanstack/react-table`, `vaul` bundle. |
| `@shadcn/mode-toggle` | Vendored as `components/ThemeToggle.tsx`. Anchored in the sidebar footer. |
| `@shadcn/empty` | Vendored as `components/ui/empty.tsx`. Used by the dashboard chart placeholder and the recent-bookings empty state. |

## 16. Theme switcher

The admin ships **light / dark / system** mode toggle:

- Toggle component: `<ThemeToggle />` (`components/ThemeToggle.tsx`), vendored from `@shadcn/mode-toggle`. Anchored in the `DashboardSidebar` footer.
- Provider: `components/ThemeProvider.tsx` — thin wrapper around `NextThemesProvider` from `next-themes` (`^0.4.6`).
- Root layout wiring (CSP-nonce aware — `next-themes`'s anti-FOUC inline script must carry the proxy's per-request nonce or `strict-dynamic` blocks it):
  ```tsx
  // apps/admin/src/app/layout.tsx
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // …
  <html lang="en" suppressHydrationWarning>
    <body>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
      >
        {children}
      </ThemeProvider>
    </body>
  </html>
  ```
- `suppressHydrationWarning` on `<html>` prevents React from complaining about the class mismatch between server (no theme class) and client (theme class injected by `next-themes`).
- **No custom inline pre-hydration script** — `next-themes` injects its own when `attribute="class"`, and the `nonce` prop above is what keeps that script alive under the admin's strict CSP.
- **Client-only persistence** — theme is stored in `localStorage`; no server round-trip, no cookie.
- System mode reflects OS-level changes in real time without a page reload.
