---
title: Admin design system
type: architecture
status: current
---

# Admin design system

The contract for **how UI is built in `apps/admin/`**. Read this before adding a new page, form, table, or component, and before reviewing one. iter-16d/e/g and iter-17/18 reference this doc as the single source of truth — if a topic isn't covered here, write it down here before fixing it in code.

The audience is admins managing events from their phones — **mobile is the primary surface, not an afterthought.** Every section has a mobile-first answer first, the desktop answer second, and an anti-pattern to avoid.

Companion docs: [`overview.md`](overview.md) (architecture rules), [`feature-slice-template.md`](feature-slice-template.md) (file-by-file checklist), [`ui-stack.md`](ui-stack.md) (library inventory).

> **Tooling note for Claude:** for any shadcn/ui task in `apps/admin/` (adding, searching, debugging, or composing primitives), invoke the `shadcn` Skill via Claude Code's Skill tool rather than running `npx shadcn@latest …` from memory or guessing component shapes. The skill reads the live registry and our `components.json`, so it stays current as shadcn evolves. This document still owns the *conventions* (tokens, spacing, a11y, etc.) — the skill owns *how to bring components in*.

## 1. Tokens

The admin's brand palette lives in `apps/admin/src/app/globals.css` as CSS variables. shadcn primitives read these — they auto-skin to the brand without modification.

| Token | Value | Use for |
|---|---|---|
| `--background` | `#1a1816` | Page background |
| `--foreground` | `#edeae4` | Body text |
| `--card` | `#26231f` | `<Card>`, raised surfaces, sheets, popovers |
| `--card-foreground` | `#edeae4` | Text on cards |
| `--primary` | `#b5564f` | Brand colour — primary buttons, focus ring, active nav |
| `--primary-foreground` | `#edeae4` | Text on `--primary` fills |
| `--secondary` | `#2e2b28` | Secondary buttons, hover states |
| `--secondary-foreground` | `#edeae4` | Text on `--secondary` fills |
| `--muted` | `#1f1d1b` | Empty-state surfaces, inactive tabs |
| `--muted-foreground` | `#b8b3ac` | Help text, captions, "5 results" rows |
| `--destructive` | `#e53e3e` | Delete buttons, error toasts, validation messages |
| `--border` | `#3a3734` | All borders by default |
| `--input` | `#3a3734` | Form-field borders specifically |
| `--ring` | `#b5564f` | Focus ring (matches `--primary` by design) |
| `--sidebar`, `--sidebar-*` | aliases of the above | shadcn `Sidebar` primitive — kept as aliases so the dark-only palette stays in lockstep with the rest of the tokens |

`--radius-m: 16px` is **adopted** as the radius for cards and large surfaces; shadcn's default `rounded-md` (6px) stays for buttons and inputs. Use `style={{ borderRadius: "var(--radius-m)" }}` only when shadcn's default doesn't fit; prefer the Tailwind `rounded-*` utilities.

**Mobile-first answer:** identical — there is one palette and it's dark.

**Desktop answer:** identical.

**Don't:**
- Hex literals (`#…`) in components or pages under `apps/admin/src/`. Always `var(--…)` or a Tailwind-mapped token (`bg-card`, `text-muted-foreground`, etc.). The token *definitions* in `apps/admin/src/app/globals.css` are the only allowed hex literals — that's where the palette lives. Vendored shadcn files in `components/ui/` are also exempt (Biome already excludes that path).
- Inventing new tokens. If you need a colour that isn't covered, raise it in the decision log and add a token; don't inline a hex.

**Contrast note (F-FE-27):** `--muted-foreground` (`#b8b3ac`) on `--background` (`#1a1816`) is borderline WCAG AA at small sizes. Reserve `text-muted-foreground` for help/caption (`text-xs`/`text-sm` non-essential). Do not use it for body copy that conveys primary information; use `--foreground` instead.

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

Built lazily — the first slice that needs each primitive lifts it from inline code. Documented here so the shape is fixed before the first implementation. **Implementation lands in iter-16d/e**, not here.

```tsx
// PageHeader — every dashboard page top
type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode; // mobile: stacks below; md: inline-right
};

// Section — wraps a logical block under a PageHeader
type SectionProps = { title?: string; children: React.ReactNode };

// EmptyState — replaces an empty list/table
type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode; // primary CTA
};

// TableSkeleton — used by loading.tsx alongside data tables
type TableSkeletonProps = { rows?: number; columns?: number };
```

**Mobile-first answer:** `<PageHeader>` stacks `actions` below the title at base width, inlines them at `md:`. `<EmptyState>` centres its content; CTA is full-width on mobile.

**Desktop answer:** `actions` floats right of the title; `<EmptyState>` keeps centred content but caps width.

**Don't:**
- Building these primitives until a slice needs them — premature.
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

**TanStack Table.** Do **not** introduce `@tanstack/react-table` for read-only data. It's currently used in `UsersTable` and `EventsTable` without sorting/filtering/pagination — that's the F-FE-03 finding to be cleaned up in iter-16d. Only adopt TanStack Table if the page genuinely needs sorting, multi-column filtering, or client-side pagination, and document the justification in the iteration plan.

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

One shared component, per-`kind` variant maps co-located with the schema that defines the values.

```tsx
// components/StatusBadge.tsx
type Kind = "user" | "event" | "service";
type Variant = "default" | "secondary" | "destructive" | "outline";

const VARIANTS: Record<Kind, Record<string, Variant>> = {
  user: { active: "default", invited: "secondary", suspended: "destructive" },
  event: { draft: "secondary", published: "default", cancelled: "destructive" },
  service: { active: "default", retired: "outline" },
};

export function StatusBadge({ kind, status }: { kind: Kind; status: string }) {
  return <Badge variant={VARIANTS[kind][status] ?? "outline"}>{status}</Badge>;
}
```

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

| Key shape | Use |
|---|---|
| `<ENTITY>_VIEW` | Reads (list, detail) |
| `<ENTITY>_CREATE` | Creates |
| `<ENTITY>_UPDATE` | Updates |
| `<ENTITY>_DELETE` | Deletes |
| `<ENTITY>_<ACTION>` | Domain verbs (`USER_INVITE`, `USER_MESSAGE`) |

**Never reuse a write permission to gate a read.** F-FE-08 records the precedent: `EVENT_CREATE` was used to gate the event-detail page, which silently hid event details from squad members who could legitimately *view* them. iter-16d adds `EVENT_VIEW` to fix this.

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
