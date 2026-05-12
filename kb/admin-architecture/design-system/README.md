---
title: Admin design system
type: architecture
status: current
---

# Admin design system

The contract for **how UI is built in `apps/admin/`**. Read the relevant sub-page before adding a new page, form, table, or component, and before reviewing one. If a topic isn't covered yet, write it down here before fixing it in code.

The audience is admins managing events from their phones — **mobile is the primary surface, not an afterthought.** Every sub-page has a mobile-first answer first, the desktop answer second, and an anti-pattern to avoid.

Companion docs: [`../overview.md`](../overview.md) (architecture rules), [`../feature-slice-template.md`](../feature-slice-template.md) (file-by-file checklist), [`../ui-stack.md`](../ui-stack.md) (library inventory).

## Sub-pages

| Topic | Page | What's in it |
|---|---|---|
| Tokens | [`tokens.md`](tokens.md) | Bordeaux brand palette, theme management, hex-bridge, contrast obligations |
| Breakpoints | [`breakpoints.md`](breakpoints.md) | Mobile-first cascade, 375px floor, touch-target rule |
| Spacing | [`spacing.md`](spacing.md) | The single page/section/card/inline scale |
| Typography | [`typography.md`](typography.md) | h1/h2/body/caption classes; no `text-base` for body |
| Layout primitives | [`layout-primitives.md`](layout-primitives.md) | `<PageHeader>`, `<Empty>`, signatures |
| Forms | [`forms.md`](forms.md) | shadcn `<Form>` + RHF + Zod shape; touch targets, error region |
| Tables | [`tables.md`](tables.md) | Cards-on-mobile/table-on-desktop strategy; no TanStack for static lists |
| Dialogs and sheets | [`dialogs-and-sheets.md`](dialogs-and-sheets.md) | When to use which; Esc-to-close while pending |
| Status badges | [`status-badges.md`](status-badges.md) | `<StatusBadge kind status>`; Bordeaux variant trade-offs |
| Icons | [`icons.md`](icons.md) | `lucide-react` only; `aria-hidden`; no Unicode dingbats |
| Permission gating | [`permission-gating-ui.md`](permission-gating-ui.md) | Server `<HasPermission>` authoritative; client hint-only |
| A11y baseline | [`a11y.md`](a11y.md) | `vitest-axe` per component; live regions; touch targets |
| Animation | [`animation.md`](animation.md) | `motion-safe:` + `transition-colors duration-200` default |
| Anti-patterns | [`anti-patterns.md`](anti-patterns.md) | Code-review checklist — condensed |
| Blocks adopted | [`blocks.md`](blocks.md) | Vendored shadcn blocks and how they're used |
| Theme switcher | [`theme.md`](theme.md) | `next-themes`, CSP nonce wiring, light/dark/system |

## Tooling note for Claude

> **Tooling matrix (when working in `apps/admin/`):**
>
> 1. **First — finding / exploring / choosing** — the `shadcn` **MCP server** (`mcp__shadcn__*` tools). Read-only. Examples: `search_items_in_registries({ registries: ["@shadcn"], query: "popover" })`, `view_items_in_registries({ items: ["@shadcn/popover"] })`, `get_item_examples_from_registries`. Use this to discover what's available before reaching for anything else.
> 2. **Second — actually vendoring** — the `shadcn` **Claude Code Skill**. It reads our `components.json` (`style: "new-york"`, `iconLibrary: "lucide"`, `cssVariables: true`), runs the right `npx shadcn@latest add` command, and knows our aliases (`@/components`, `@/lib`, `@/hooks`).
> 3. **Third — manual / emergency** — the CLI directly: `npx shadcn@latest add <item> -c apps/admin`. Verify the result against `components.json` afterwards.
>
> One-line rule: **the sub-pages own the conventions** (tokens, spacing, a11y, etc.); MCP and the Skill own discovery and installation.
