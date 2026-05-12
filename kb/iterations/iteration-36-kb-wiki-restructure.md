---
title: Iteration 36 — KB wiki restructure (split design-system.md, harden overview as hub)
type: iteration
order: 37
status: planned
---

# Iteration 36 — KB wiki restructure (split design-system.md, harden overview as hub)

Make `kb/admin-architecture/` behave like a wiki: an agent (or human) reads `overview.md` first, gets the index, and follows links to the **one specific section** they need — without loading the whole design system into context. Most of `kb/admin-architecture/` is already per-topic (`auth-and-permissions.md`, `data-layer.md`, `server-layer.md`, `ui-stack.md`, `typescript-conventions.md`, `folder-structure.md` — all 138–250 lines). The single fat file is `design-system.md` (428 lines, ~25k tokens). Splitting that is 90% of the win.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. Doc-only — zero production blast radius, zero `npm run verify` impact except markdown lint if any.

## Decisions

- **Scope is narrow.** Split *only* `design-system.md`, not the other docs. The others (`auth-and-permissions.md` at 250 lines, `server-layer.md` at 214 lines, etc.) are within reasonable read-on-demand range and topical already — splitting them would create churn for negligible benefit. `decision-log.md` (315 lines) stays whole — it's chronological-by-ADR, not topical.
- **`overview.md` becomes the wiki hub.** Each row in the "Detailed docs" table gets per-topic sub-links into the new design-system files, not just a single "design-system.md" link. An agent should see "Forms → forms.md" not "UI → design-system.md".
- **Section anchors stay valid via per-file pages.** `design-system.md` currently has §1..§16. Each becomes its own short file: `tokens.md`, `breakpoints.md`, `spacing.md`, `typography.md`, `layout-primitives.md`, `forms.md`, `tables.md`, `dialogs-and-sheets.md`, `status-badges.md`, `icons.md`, `permission-gating-ui.md`, `a11y.md`, `animation.md`, `anti-patterns.md`, `blocks.md`, `theme.md`. New files live under a new sub-directory **`kb/admin-architecture/design-system/`** to avoid polluting the architecture-doc top level and to make the new wiki node obvious.
- **`design-system.md` itself is replaced by `design-system/README.md`** — a thin index (≤ 60 lines) with a one-line description per sub-page and a links table. Cross-doc references (`design-system.md#forms`, etc.) that hyalo finds in the iteration plans, audits, decision log, and the homepage/admin code comments get rewritten to point at the new sub-pages.
- **`hyalo mv` rewrites links across the vault** — use it, don't `git mv` + manual sed. The CLI is built for this.
- **`overview.md` is the single index.** No competing "design-system index" — the design-system README is a sub-index that overview links into, but overview is the canonical entry point.
- **No content rewrite.** Each new sub-page is the corresponding § of `design-system.md` extracted verbatim, with the heading-level demoted by one (§ heading → `# Heading`). The point of this iteration is *structure*, not editorial. Content rewrites happen as their own iterations when the rules themselves change.
- **Update the `nextjs-frontend-engineer.md` agent prompt** to point at the new per-topic pages by name (e.g. "If you're touching forms → `kb/admin-architecture/design-system/forms.md`") so the index-first reading rule has concrete targets instead of `--section` calls against a fat file.
- **Update root `CLAUDE.md`** references to point at the new shape.
- **Update `kb/audits/findings-index.md`** any cross-references that hit `design-system.md#…` anchors.

## Pre-flight

- [ ] iter-35 merged on `main` (or in flight without conflicts — this iteration is doc-only, parallel-safe).
- [ ] No in-flight branches touching `kb/admin-architecture/`, `.claude/agents/nextjs-frontend-engineer.md`, or root `CLAUDE.md`.
- [ ] `hyalo --version` succeeds (the CLI is the implementation tool for this iteration).

## Scope

### 1. Inventory the splits

Read `kb/admin-architecture/design-system.md` once, list its §1..§16 headings, decide the per-file slug for each (e.g. §8 "Dialogs vs sheets on mobile" → `dialogs-and-sheets.md`). Capture the mapping in a temporary `splits.json` (one-off — not checked in). The 16 sub-pages are:

| § | Source heading | Target file |
|---|---|---|
| 1 | Tokens | `tokens.md` |
| 2 | Breakpoints + responsive baseline | `breakpoints.md` |
| 3 | Spacing | `spacing.md` |
| 4 | Typography | `typography.md` |
| 5 | Layout primitives | `layout-primitives.md` |
| 6 | Forms | `forms.md` |
| 7 | Tables — responsive strategy | `tables.md` |
| 8 | Dialogs vs sheets on mobile | `dialogs-and-sheets.md` |
| 9 | Status badges | `status-badges.md` |
| 10 | Icons | `icons.md` |
| 11 | Permission gating | `permission-gating-ui.md` |
| 12 | A11y baseline | `a11y.md` |
| 13 | Animation | `animation.md` |
| 14 | Anti-patterns | `anti-patterns.md` |
| 15 | Blocks adopted | `blocks.md` |
| 16 | Theme switcher | `theme.md` |

### 2. Create the new sub-pages

Create `kb/admin-architecture/design-system/` directory. Write each sub-page with:

- **Frontmatter:** `title: <Slug>`, `type: architecture`, `status: current`.
- **Body:** the corresponding § of `design-system.md`, heading promoted by one level (the `## N. <Topic>` becomes `# <Topic>` at the top of the new file).
- **Footer:** one-line "See also" linking back to `../overview.md` and to any naturally-adjacent sub-page (e.g. `forms.md` mentions `a11y.md` already — keep that as a real link, not an anchor).

Mechanical extraction. No paraphrasing.

### 3. Write the new design-system README

Create `kb/admin-architecture/design-system/README.md`:

- Title: "Admin design system"
- One-paragraph intro from the current `design-system.md` preamble.
- Companion-doc note pointing back to `../overview.md`, `../feature-slice-template.md`, `../ui-stack.md`.
- A table of the 16 sub-pages with a one-line description each.
- The "Tooling note for Claude" about the shadcn skill stays here.

Keep it ≤ 60 lines. It's a hub, not content.

### 4. Replace the old `design-system.md`

Delete `kb/admin-architecture/design-system.md`. Use `hyalo mv` (or its closest available command) to rewrite cross-vault links from `design-system.md` (and `design-system.md#section`) to the right new path:

- Bare `design-system.md` → `design-system/README.md`
- `design-system.md#tokens` (or `#1-tokens`, depending on slugger) → `design-system/tokens.md`
- …and the 15 others.

Apply across:
- `kb/admin-architecture/overview.md`
- `kb/audits/findings-index.md`
- `kb/audits/iter-33-monorepo-audit.md`
- `kb/admin-architecture/decision-log.md`
- `kb/admin-architecture/feature-slice-template.md`
- `kb/admin-architecture/ui-stack.md`
- Any `kb/iterations/iteration-*.md` that link to design-system sections.
- `apps/admin/src/**/*.tsx` / `.ts` comments (skim — design-system comments do exist in components/ui).
- Root `CLAUDE.md` and `.claude/CLAUDE.md`.

Verify after the rewrite: `hyalo find "design-system.md"` returns zero hits (or only this iteration plan).

### 5. Rewrite `overview.md` "Detailed docs" table

The current "Building UI? Read first → design-system.md" row becomes a sub-section listing the 16 design-system pages with one-line descriptions, so an agent reading `overview.md` sees at a glance which exact page they need. Other rows in the table unchanged.

### 6. Update the `nextjs-frontend-engineer.md` agent prompt

The agent's "Index-first knowledgebase reading" block currently tells the agent to pull `--section` from `design-system.md`. Rewrite it to:

- Point at `kb/admin-architecture/overview.md` as the always-read index.
- List the 16 per-topic design-system pages with their canonical paths.
- Replace the `hyalo read --section "Forms"` example with `hyalo read kb/admin-architecture/design-system/forms.md`.
- Drop the "design-system is being rewritten" note (it isn't, once this iteration lands).

Single commit, scoped to `.claude/agents/nextjs-frontend-engineer.md`. The linter has shown it tends to revert this file when overhauled — keep the diff surgical.

### 7. Update root `CLAUDE.md`

The "Admin app architecture" section references `kb/admin-architecture/design-system.md` directly. Rewrite to point at `kb/admin-architecture/design-system/README.md` and call out that the design system is now wiki-structured. Keep it terse; CLAUDE.md is read into every conversation.

## Done when

- [ ] `kb/admin-architecture/design-system.md` deleted.
- [ ] `kb/admin-architecture/design-system/` contains `README.md` + 16 sub-pages, each with frontmatter and "See also" footer.
- [ ] `hyalo find "design-system.md"` (literal-string search) returns zero hits outside this iteration plan.
- [ ] `overview.md` lists every sub-page in its detailed-docs section.
- [ ] `.claude/agents/nextjs-frontend-engineer.md` points at the new paths in its index-first block.
- [ ] Root `CLAUDE.md` and `.claude/CLAUDE.md` reference the new shape.
- [ ] `npm run verify` green (should be a no-op — pure doc changes).
- [ ] One commit per logical step (sub-pages created, README written, old file deleted + links rewritten, agent prompt, CLAUDE.md). Five-ish commits total; revertible per step.

## Heads-up

- **Not in scope for this iteration:**
  - Splitting `auth-and-permissions.md`, `server-layer.md`, etc. They're already per-topic and within reasonable read-on-demand range.
  - Editing design-system *content*. Verbatim extraction only. If a rule looks wrong during the split, file a finding — don't fix it here.
  - Renaming `kb/admin-architecture/` to something shorter (it's deep but stable; renaming the directory rewrites every cross-link in the repo). Reconsider if/when the kb grows further.
  - `kb/audits/` restructure. The audit pattern is fine as-is; one finding-per-section in a single file is a feature, not a bug.
- **Memory updates after merge:** `project_kb_restructure_pending` (mark resolved or delete entirely), `project_iteration_status` (iter-36 → done). The `feature-slice-template.md` linking-to-design-system convention should be updated in `feature-slice-template.md` itself during step 4.
- **No agent split this iteration.** See conversation context: the user weighed splitting `nextjs-frontend-engineer` into a "designer" + "frontend-engineer" pair and leaned no. Confirmed: design *judgement* in this project is human (the user authoring `.pen` files and design-system ADRs); the agent's job is faithful implementation of an existing design. A second agent would create handoff overhead with no division of labour. **A devops/infra agent for `infra/terraform/` + `.github/workflows/` + bunny.net / hoppy is a more useful future split** — different toolchain, different review concerns (deploy safety, secrets, state files), the frontend agent is overspecialised for that surface. Not part of this iteration; capture as a follow-up consideration.
