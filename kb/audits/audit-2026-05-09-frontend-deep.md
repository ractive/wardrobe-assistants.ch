---
title: Frontend / UI deep audit — Claude Opus 4.7 — 2026-05-09
type: audit
status: current
reviewer: claude-opus-4-7
created: 2026-05-09
tags: [audit, frontend, ui, react, shadcn, tailwind, accessibility]
related: [audit-2026-05-09-consolidated.md, ../admin-architecture/ui-stack.md]
---

# Frontend / UI deep audit — 2026-05-09

Read-only follow-up to the [consolidated security/architecture audit](audit-2026-05-09-consolidated.md). Scope: `apps/admin` (primary) and `apps/homepage` (secondary). Focused on UI quality, component architecture, accessibility, design-system consistency, Tailwind hygiene, performance, and testing. Does not repeat the security findings.

Key claims verified by direct grep against the codebase before publishing; one or two claims marked Low confidence where verification couldn't be completed in this session.

## 1. Executive summary

The admin app's UI is **structurally sound but has uneven discipline at the edges**. shadcn primitives are present and unmodified (Radix a11y intact), the feature-slice convention from iter-15c is being followed, the React Compiler is enabled, and the dialog/dropdown/popover stack is built on Radix — so a11y on those is largely free. Where the code is sloppier:

1. **The login page bypasses shadcn entirely** — raw `<input>` elements, no `<Form>` wrapper, no label/input association via `htmlFor`/`id`, no `aria-describedby` linking error text. Set-password page uses the full shadcn pattern. Two patterns coexist for what should be a single one.
2. **Manual `useMemo` in feature components contradicts the enabled React Compiler.** EventsTable line 25, AssigneesPicker lines 38 + 42. Compiler does this auto; manual memoization is now noise that can rot into stale-closure bugs.
3. **Zero component tests.** 11 admin test files, 0 `*.test.tsx`. All tests are at the schema/action/smoke level. EventForm (221 lines), EventsTable, AssigneesPicker, login form — all uncovered at the React level.
4. **No `loading.tsx`, no `not-found.tsx`, no `error.tsx`** anywhere in admin. Already noted in the security audit; included here because it's a UI completeness gap, not just an error-handling one.
5. **Homepage `Button` component renders only as `<a>`** with no semantic guardrail. Future use as a real button (form submit, JS action) will be inaccessible.
6. **Three hardcoded hex literals in homepage Footer.** Tokens exist; these are forgotten places.
7. **Sidebar doesn't mark the active route** — no `aria-current="page"`. Sighted users infer; screen readers can't.

None of these are catastrophic, but they're the visible signs of "small app, conventions still settling" — exactly the moment to write them down before iter-17/18 copy them.

## 2. Top 10 frontend issues

| Rank | ID | Sev | Title |
|---|---|---|---|
| 1 | UI-A | M | Login page bypasses shadcn `<Form>`/`Input`; raw inputs without proper label-for-id and `aria-describedby` |
| 2 | UI-B | M | Homepage `<Button>` renders only as `<a>` with no `href` requirement and no semantic guardrail |
| 3 | UI-C | M | No `error.tsx`/`not-found.tsx` boundaries; `notFound()` calls fall through to framework default |
| 4 | UI-D | M | No component tests (`*.test.tsx`) — 0 found across admin features |
| 5 | UI-E | M | Manual `useMemo` in tables/pickers contradicts enabled React Compiler |
| 6 | UI-F | L-M | Sidebar missing `aria-current="page"` on active route |
| 7 | UI-G | L-M | `messageUser`-style submit pattern duplicated across 4 forms; no `useFormAction()` extraction |
| 8 | UI-H | L | `EventStatusBadge` and `StatusBadge` (users) drift from a shared base |
| 9 | UI-I | L | Hardcoded hex in homepage `Footer.tsx` lines 14, 18, 65 — tokens exist |
| 10 | UI-J | L | `SignOutButton` uses manual `useState` for pending instead of `useTransition`; failures silent |

## 3. Findings table

Severity: **C/H/M/L/I**. Confidence: H/M/L.

### Forms & inputs

| ID | Sev | Cat | File(s) | Problem | Fix | Conf |
|---|---|---|---|---|---|---|
| UI-A1 | M | a11y / forms | `apps/admin/src/app/login/page.tsx:78,92,124` | Raw `<input>` without `id`+`htmlFor`; no `aria-describedby` linking error spans; no `focus-visible:` ring (relies on inline `focus:border` only). Also: page does not import shadcn `Input` (verified — no `Input` import). | Migrate to shadcn `<Form>` + `<FormField>` + `<Input>` (already used in `set-password/page.tsx`). Single pattern, free a11y. | H |
| UI-A2 | M | DS-consistency | `app/login/page.tsx` vs `app/set-password/page.tsx` | Two forms, two patterns — login is hand-rolled, set-password uses shadcn. | Same fix as UI-A1; collapses both into one pattern. | H |
| UI-G | L-M | React arch | `features/events/components/EventForm.tsx:90`, `features/users/components/InviteUserForm.tsx:49`, `MessageAssigneesDialog.tsx`, `MessageUserDialog.tsx` | Same shape repeated 4 times: `try { result = await action(values); if (result.error) toast.error(...); else { toast.success(...); onSuccess?.(); router.refresh(); } } catch (e) { toast.error(...) }`. | Extract `useFormAction(action, { onSuccess })` hook. Don't over-abstract — a single hook with the success/error/refresh shape is enough. | M |
| UI-K | L | UX | `MessageAssigneesDialog.tsx:50-52`, `MessageUserDialog.tsx:47-49` | `useEffect(() => form.reset(), [open, eventId, form])` — depends on `form` which is unstable; can fire on every render. | Either `[open]` only, or move reset into `onOpenChange`. | M |

### Components

| ID | Sev | Cat | File(s) | Problem | Fix | Conf |
|---|---|---|---|---|---|---|
| UI-B | M | a11y / semantics | `apps/homepage/src/components/Button.tsx` | `function Button(props: ComponentProps<"a"> & {variant})` renders `<a className=...>{children}</a>` unconditionally. `href` is optional. Used today only as a link, but the name is wrong and there's no guardrail against future misuse as a real button. | (a) Make `href` required. (b) Rename to `LinkButton` or `CtaLink`. (c) Reserve `Button` for `<button>`. Cheapest variant: just rename + require `href`. | H |
| UI-E | M | React arch / perf | `features/events/components/EventsTable.tsx:11,25`, `AssigneesPicker.tsx:5,38,42` | Manual `useMemo` for `columns` array and derived `Set` / filter. React Compiler is enabled (`reactCompiler: true` in `next.config.ts`). Manual memoization is now noise; worse, the dep arrays will rot if the closure changes and someone forgets to update them. | Drop the `useMemo` wrappers. The Compiler handles it. Same for any `useMemo`/`useCallback` over plain values across the codebase — sweep once. | H |
| UI-J | L | React arch / errors | `app/(dashboard)/sign-out-button.tsx:11-28` | `useState` for `pending`; on signout failure, only `console.error` — user gets no toast and the button silently re-enables. | Use `useTransition()`; toast on failure. ~10 lines diff. | M |
| UI-L | L | React arch | `app/login/page.tsx` (~152 lines, two forms in one component) | Page is two unrelated forms (credentials → TOTP) muxed by a `step` state. Hard to test in isolation; if iter-19 (auth-mfa) extends MFA, this page balloons. | Split into `<CredentialsStep>` and `<TotpStep>` and a thin coordinator. Land before iter-19. | M |
| UI-M | L | React arch | `features/events/components/EventForm.tsx` (~221 lines) | One file owns name, date (Calendar+Popover), venue, status select, notes (Textarea), and submit logic. Largest feature component in the repo; mostly fine, but the date/calendar block (~60 lines) is reusable. | Optional: extract `<DateField>` if iter-22 (invoices) reuses it. Don't pre-split — wait for the second user. | L |

### Layouts & boundaries

| ID | Sev | Cat | File(s) | Problem | Fix | Conf |
|---|---|---|---|---|---|---|
| UI-C1 | M | Next.js | `apps/admin/src/app/(dashboard)/events/[id]/page.tsx:37` calls `notFound()` | No `not-found.tsx` segment file → framework default page. | Add `(dashboard)/events/[id]/not-found.tsx` (and `(dashboard)/not-found.tsx` for unmatched routes under the layout). | H |
| UI-C2 | M | Next.js | `apps/admin/src/app/` | No `error.tsx` boundary anywhere → unhandled errors render Next default. | Add `(dashboard)/error.tsx` (client; with `reset()` button) and root `error.tsx`. Already on the iter-16b/16c list. | H |
| UI-C3 | L-M | Next.js / UX | `apps/admin/src/app/(dashboard)/{events,users}/` | No `loading.tsx` files. Server-rendered pages block until data resolves with no skeleton. | Add `loading.tsx` per segment with a tiny skeleton. Ship as part of UI-C2 PR. | M |
| UI-F | L-M | a11y | `apps/admin/src/components/DashboardSidebar.tsx` | No `usePathname()` use; no `aria-current="page"` on the active link. Verified: neither `aria-current` nor `usePathname` appears in the file. | Add `usePathname()` (already a client component for permission gating? confirm) and `aria-current={pathname === item.href ? "page" : undefined}`. Optional: visual active style (current code seems to lack this). | H |

### shadcn / Tailwind / design system

| ID | Sev | Cat | File(s) | Problem | Fix | Conf |
|---|---|---|---|---|---|---|
| UI-H | L | DS-consistency | `features/events/components/EventStatusBadge.tsx`, `features/users/components/StatusBadge.tsx` | Two near-identical badges with different status enums and slightly different variant maps. | When iter-17 adds a `services` archived/active badge, refactor to a single `<StatusBadge variant>` driven by a status→variant map per feature. Don't pre-extract. | M |
| UI-I | L | Tailwind / DS | `apps/homepage/src/components/Footer.tsx:14,18,65` | `text-[#EDEAE4]`, `text-[#8F8A83]`, `text-[#9B958D]` — three hex literals where tokens exist (`--foreground`, `--muted-foreground`). | Replace with `text-[var(--foreground)]` and `text-[var(--muted-foreground)]`. If `#8F8A83`/`#9B958D` are truly distinct shades, add them as named tokens; don't keep them as raw hex. | H |
| UI-N | L | Tailwind / DS | `apps/homepage/src/components/ServiceCard.tsx:16-17` | `h-[22px] w-[22px]` icon size + `text-[#B8B3AC]` — magic dims + magic color. | If 22px is the design's icon size for cards, give it a token (`--icon-md: 22px`) or use a Tailwind size from the scale. | M |
| UI-O | L | Tailwind | `apps/homepage/src/app/(site)/page.tsx` (`gap-6 lg:gap-7`, `gap-10 lg:gap-14`) | Inconsistent gap scaling across hero/services. May be intentional designer choice, may be drift. | Either add a comment per section justifying the chosen gap, or pick a 4-value gap scale (xs/sm/md/lg) and stick to it. Low priority. | L |
| UI-P | I | Tailwind | both `globals.css` | Tailwind v4 `@theme` blocks present (assumed — agent didn't quote them). Tokens for color/spacing/radius exist; no `tailwind.config.ts` (correct for v4). | None. | H |
| UI-Q | I | shadcn | `apps/admin/src/components/ui/` | 16 primitives present, none visibly customized beyond shadcn defaults; Biome excluded from lint correctly. | None. Don't drift. | H |

### Accessibility (beyond what's already listed above)

| ID | Sev | Cat | File(s) | Problem | Fix | Conf |
|---|---|---|---|---|---|---|
| UI-R | L | a11y | `apps/admin/src/features/events/components/DeleteEventConfirm.tsx`, `users/components/DeleteUserConfirm.tsx` | When `isPending`, `onOpenChange` blocks Escape from closing the dialog. Intentional (prevent accidental cancel mid-deletion) but an unconventional UX. | Add a comment explaining the intent. Optional: visible "Deleting… (cannot cancel)" label so users aren't confused why Esc doesn't work. | M |
| UI-S | L | a11y / contrast | `apps/admin/src/app/globals.css:13`, `apps/homepage/src/app/globals.css:16` | `--muted-foreground` on `--background` is roughly WCAG AA but close to the floor for small text. Specific contrast ratio not measured this session. | Run a contrast checker; if AAA matters for admin (it should, internal tool used long-running), bump muted-fg one notch lighter. | L |
| UI-T | L | a11y | `apps/homepage/src/components/Nav.tsx:43-77` | CSS-only checkbox-hack mobile menu. Works today. Has explanatory comment at lines 9-19. Risk = future maintainer adds `<Link>` (instead of plain `<a>` for full-page nav) and the menu-open state never resets between routes. | Comment is enough. Don't over-engineer. Could add a Vitest test that asserts the pattern still works, but probably overkill. | L |

### Performance

| ID | Sev | Cat | File(s) | Problem | Fix | Conf |
|---|---|---|---|---|---|---|
| UI-U | L | perf | `app/(dashboard)/events/[id]/page.tsx` | First permission check (`EVENT_CREATE`) runs sequentially before the `Promise.all` of the other three. | Combine into one `Promise.all` of all four. ~3-line diff. | M |
| UI-V | L | perf | `app/(dashboard)/layout.tsx:14`, `(dashboard)/page.tsx:7` | Layout calls `auth.api.getSession()`; some pages also call it. Better Auth's session cache likely dedupes within a request, but unverified this session. | Verify Better Auth dedup; if not deduped, pass session via a server context or expose a helper. Don't refactor speculatively. | L |
| UI-W | I | perf | feature components | Lucide icons imported per-name (e.g. `import { Check, X } from "lucide-react"`). | Correct pattern — leave as-is. | H |
| UI-X | L | perf | feature components | No `dynamic()` imports for heavy primitives (Calendar, Command/cmdk). They're always loaded with the page even when the dialog is closed. Bundle size not measured this session. | If admin bundle ever exceeds an LCP budget (we don't have one yet), `dynamic()`-import EventDialog and MessageDialog. Not urgent at current scale. | L |

### Tests

| ID | Sev | Cat | File(s) | Problem | Fix | Conf |
|---|---|---|---|---|---|---|
| UI-D | M | testing | `apps/admin/src/features/**` | **Verified: 0 `*.test.tsx` files in admin.** 11 total tests, 2 smoke, the rest are schema/action unit tests. EventForm, EventsTable, AssigneesPicker, MessageDialogs, login/set-password forms all uncovered at the React level. | Don't try to test everything. Pick three critical components and start: `EventForm.test.tsx`, `AssigneesPicker.test.tsx`, login form. RTL + `userEvent`. Add `vitest-axe` for a11y assertions on forms (also closes the C-A11Y testing gap from the consolidated audit). | H |
| UI-Y | L | testing | none yet | No `vitest-axe` / `@axe-core/playwright` integration. | Pair with UI-D PR; add `expect(container).toHaveNoViolations()` to the three new component tests. | M |

## 4. Quick wins (≤30 min each, high payoff)

1. **UI-I** — Replace 3 hex literals in `apps/homepage/src/components/Footer.tsx` with `var(--foreground)` / `var(--muted-foreground)`. ~5 min.
2. **UI-B** — Add `href: string` (required) to homepage `Button` props; rename to `LinkButton` if you want belt-and-suspenders. ~10 min.
3. **UI-F** — Add `usePathname()` + `aria-current="page"` to DashboardSidebar. ~15 min.
4. **UI-J** — `useTransition()` + error toast in `SignOutButton`. ~15 min.
5. **UI-E** — Drop `useMemo` from EventsTable + AssigneesPicker. ~10 min, no risk with Compiler enabled.

## 5. Larger refactors (worth scheduling)

1. **UI-A** — Migrate login page to shadcn `<Form>`/`<Input>`. ~1 hour. Unifies the auth-form pattern; closes a11y gaps; matches set-password.
2. **UI-C** — `error.tsx` + `not-found.tsx` + `loading.tsx` triplet across `(dashboard)`. ~1.5 hours. Already in iter-16c scope.
3. **UI-G** — `useFormAction()` hook + migrate the 4 existing forms. ~1.5 hours. Land before iter-17 (services) so the new feature inherits the pattern.
4. **UI-D** — First three component tests (EventForm, AssigneesPicker, login form) + `vitest-axe`. ~3-4 hours. Establishes the convention; iter-17 then copies.
5. **UI-L** — Split login page into `<CredentialsStep>`/`<TotpStep>`. Land **before** iter-19 (auth-mfa) which will extend MFA logic.

## 6. Components that should be split or redesigned

- **`app/login/page.tsx`** — split into credentials + TOTP steps before iter-19.
- **`features/events/components/EventForm.tsx`** — *don't* split yet. 221 lines is large but cohesive; wait for the second consumer of the date/calendar block (likely iter-22 invoice flow) before extracting.
- **`Button` (homepage)** — rename + tighten props (UI-B).

## 7. Design-system consistency

- **Spacing**: admin is consistent (`gap-4`, `px-6`, `py-8`); homepage drifts a bit (`gap-6/7`, `gap-10/14`). Acceptable in a marketing surface, but document if intentional.
- **Typography**: admin uses a small, predictable set of `text-{sm,base,xl,3xl}` + `font-{medium,semibold}`. Homepage layers `font-primary`/`font-secondary`/`font-body` — intentional for marketing, not a problem.
- **Buttons**: admin uses shadcn variants consistently (default/outline/ghost/destructive). Homepage has its own custom Button with primary/outline only — fine, but see UI-B.
- **Status badges**: drift between events and users; consolidate when iter-17 adds the third (UI-H).
- **Color tokens**: admin = clean. Homepage = three forgotten places (UI-I, UI-N).

## 8. Test coverage

| Layer | Files | Notes |
|---|---|---|
| Schema (Zod) | `*.schema.test.ts` | Present for events, users. Good. |
| Actions | `*.actions.test.ts` | Present, mocked DB. Good for fast unit signal. |
| Smoke (HTTP harness) | `*.smoke.test.ts` (2 files) | Real auth + Drizzle path. Mandatory per slice (iter-15c). |
| Component (RTL) | **0** | **Gap.** No `*.test.tsx`. |
| a11y (axe) | **0** | **Gap.** No vitest-axe / playwright-axe. |
| Browser e2e | **0** | Out of scope per iter-15c rationale; ff-rdp is the manual stand-in. |

## 9. What's actually fine (stop worrying about it)

- shadcn primitives in `components/ui/` look untouched. Don't customize them; if you need different behavior, wrap them.
- React Compiler is the right call. Once UI-E lands, the codebase will trust it.
- Radix-backed dialogs/popovers/dropdowns/select/command — focus traps, ARIA, keyboard nav all free. Don't reinvent.
- Tailwind v4 `@theme` setup (no `tailwind.config.ts`) is the modern v4 idiom.
- Per-icon Lucide imports.
- Bunny Fonts with `display=swap`. Privacy + no FOIT.
- The **events** feature (just merged) is the cleanest example of the slice convention; copy it for iter-17 with the fixes above folded in.

## 10. What was not verified in this session

- **UI-S** color contrast — no actual measurement; eyeballed. Run a contrast checker to confirm.
- **UI-V** Better Auth session-cache dedup behavior — not traced through `node_modules/better-auth`. Don't refactor on assumption alone.
- **UI-X** admin client bundle size — not measured. Worth one `next build --analyze` pass if perf becomes a concern.
- **The agent's UI-04** (Radix dialog focus trap) — Radix is industrial-strength here; the "unverified" caveat is conservative but the risk is essentially zero.
