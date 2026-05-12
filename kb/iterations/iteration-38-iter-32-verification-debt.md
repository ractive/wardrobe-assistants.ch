---
title: Iteration 38 — iter-32 verification debt + iter-31 deploy smokes
type: iteration
order: 39
status: planned
---

# Iteration 38 — iter-32 verification debt + iter-31 deploy smokes

Close the verification gap left by [iter-32](iteration-32-admin-bordeaux-theme.md) — the bordeaux theme landed but every visual / contrast / focus-ring / baseline-screenshot item in §"Done when" was deferred per the `844b741` doc commit. Also picks up the three [iter-31](iteration-31-booking-request-polish.md) post-deployment smokes that depend on a deployed admin (proxy curl-check, build-time catalog non-empty, end-to-end customer flow).

Implemented autonomously by `/ralph-loop` where possible; **§E is an explicitly-human checklist** the user runs post-merge because the autonomous loop can't make visual judgement calls. Must leave the system fully working at the iteration boundary.

## Decisions

- **Split work by who can do it.** §§A–D are mechanical: code changes (chart-token re-derive), screenshot capture via ff-rdp, automated contrast assertions, audit-as-code findings. §E is a checklist with explicit human steps — the iteration is "done" when §§A–D land green and §E is *queued for the user* with the artefacts (screenshots, contrast report) the user needs to make those judgements quickly.
- **Don't re-run iter-32's TweakCN palette.** The palette landed; this iteration verifies it and rederives only `chart-2..5` per iter-32 §3. If contrast checks (§B) surface a true WCAG failure, raise it as a finding for a follow-up iter-38b that owns the palette adjustment — don't fold a palette change into a verification iteration.
- **Screenshots are committed under `kb/screenshots/iter-32-bordeaux/`** per iter-32's deferred Done-when item. Two folders: `light/` and `dark/`. One PNG per page. ff-rdp's screenshot primitive is the capture tool.
- **Automated contrast checks via a one-shot script.** Add `scripts/check-contrast.mjs` reading `apps/admin/src/app/globals.css` `:root` + `.dark` blocks and asserting every documented pair (`--foreground` on `--background`, `--primary-foreground` on `--primary`, `--destructive-foreground` on `--destructive`, etc.) meets WCAG AA. Run inline in `npm run verify` if it stays fast, otherwise as a separate `npm run check:contrast` script invoked manually.
- **iter-31 deploy smokes (§D) need a deployed admin.** The autonomous loop can write the smoke scripts (curl probes, build-output greps) but the actual *running* of them is gated on the iter-31 → iter-37 → iter-38 deploy pipeline reaching prod. Mark the smoke scripts as artefacts; treat their first green run as a separate step.
- **No design-system content edits.** This iteration verifies the spec, doesn't rewrite it. If a rule looks wrong during verification, raise a finding — defer to the design-system rewrite iteration (or to iter-36 if not yet merged).
- **`ff-rdp` dogfooding** report appended at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md`. This iteration exercises ff-rdp heavily for visual capture — make the report substantive.

## Pre-flight

- [ ] iter-32 merged (commit `81e6d23`). Bordeaux palette present in `apps/admin/src/app/globals.css`.
- [ ] iter-34 merged (commit `3d3ddac`). The vitest-axe gap closure means the a11y baseline is already tightened — this iteration adds the *visual* baseline on top.
- [ ] iter-37 status confirmed (independent; either order works).
- [ ] `npm run verify` green on `main`.

## Scope

### A. Re-derive `chart-2..5` as a bordeaux-anchored family (closes iter-32 §3)

`apps/admin/src/app/globals.css`. Current state: `chart-1` matches `--primary` (bordeaux); `chart-2..5` are TweakCN's stock multicolor sequence, *not* the bordeaux-anchored complementary family iter-32 §3 specified.

- **Derive `chart-2..5`** by stepping through complementary hues in the same OKLCH lightness band as `chart-1`: warm desaturated brown, muted gold, soft rose, neutral taupe. Use TweakCN's chart-palette generator with `chart-1` as the anchor — don't hand-roll.
- **Apply to both `:root` and `.dark`** blocks.
- **No consumer code today** (charts ship with iter-22). This § is "have the family ready when iter-22 lands" — verified by spot-rendering a static test page with 5 swatches and confirming they read as one family. One-off scratch page, not committed.

### B. Automated WCAG AA contrast checks (closes iter-32 Done-when "every WCAG AA pair from §6 passes ≥ 4.5:1")

- **Add `scripts/check-contrast.mjs`.** Reads `apps/admin/src/app/globals.css`, parses every `--foreground` / `--background` style pair (foreground + background, primary + primary-foreground, secondary + secondary-foreground, destructive + destructive-foreground, muted + muted-foreground, accent + accent-foreground, card + card-foreground, popover + popover-foreground, sidebar + sidebar-foreground, sidebar-primary + sidebar-primary-foreground, sidebar-accent + sidebar-accent-foreground), computes WCAG contrast ratio, asserts ≥ 4.5:1 (small text) or ≥ 3:1 (large text / UI components — per WCAG AA).
- **Small dep:** `culori` or `colorjs.io` for OKLCH → sRGB → luminance conversion. Whichever has the smaller bundle footprint; either is fine.
- **Output:** pass/fail table to stdout; non-zero exit if any pair fails. Run in both `:root` (light) and `.dark` modes.
- **Wire into `npm run verify`** if execution takes < 1s; otherwise add `npm run check:contrast` script and document it in `CLAUDE.md` quality-gates section.
- **Edge cases:** `--muted-foreground` on `--background` is documented as "borderline WCAG AA at small sizes" (design-system §1 contrast note). The script must allow this pair to be in a *warn* tier (not fail) per the existing carve-out, and document it inline.
- **If any other pair fails:** record as a finding for iter-38b (palette adjustment), don't fix in this iteration. iter-38 verifies; iter-38b adjusts.

### C. Visual baseline capture (closes iter-32 Done-when "visual regression baseline screenshots")

Use `ff-rdp` to capture one PNG per admin page in both light and dark mode. Commit under `kb/screenshots/iter-32-bordeaux/light/` and `kb/screenshots/iter-32-bordeaux/dark/`. File-naming convention: `<route-slug>.png` (e.g. `dashboard.png`, `bookings.png`, `bookings--detail.png`, `bookings--new.png`, `services.png`, `users.png`, `my-bookings.png`, `login.png`, `set-password.png`, `offer-token.png`).

Pages to capture (one screenshot per page per mode = ~20 PNGs total):
- `/` (dashboard)
- `/bookings` (list)
- `/bookings/<sample-id>` (detail)
- `/bookings/new`
- `/services`
- `/users`
- `/my-bookings`
- `/my-bookings/<sample-id>`
- `/login`
- `/set-password`
- `/offer/<sample-token>` (public — for completeness)

Capture at viewport 1024px (desktop) and 375px (mobile iPhone-SE) — that's the design-system contract; iteration-32 §"Done when" didn't specify viewport. Pick desktop only here to keep the PR diff manageable; mobile baseline can land in a follow-up if visual drift is suspected on narrow viewports.

These are baselines, not assertions — they exist so that *future* iterations have a visual-diff target for visual regressions, not so iter-38 catches anything. The point of committing them is reproducibility, not validation.

### D. iter-31 deploy-smoke scripts (writes the smokes; runs them post-deploy)

Three smoke scripts under `scripts/smoke/` that the iter-31 post-deployment Done-when items called for but never landed:

1. **`scripts/smoke/proxy-public-paths.sh`** — `curl -sS -o /dev/null -w "%{http_code}\n" https://admin.wardrobe-assistants.ch/api/public/services` returns `200` (not `307`). Same for `GET /api/public/services` and a `POST /api/public/booking-requests` with a valid throwaway payload. Exit non-zero on any 307 / 4xx / 5xx (other than the documented rate-limit 429 if the bucket is exhausted — log and continue).

2. **`scripts/smoke/homepage-catalog-non-empty.sh`** — fetches the built homepage's `/booking-request` page (either the deployed URL or a local `apps/homepage/.next/...` output if available) and `grep -c '"id"'` confirms the service-catalog JSON is non-empty. Exit non-zero if zero matches.

3. **`scripts/smoke/booking-request-e2e.md`** — *manual* checklist (markdown, not shell). Steps the user (or QA agent) walks through interactively: homepage → click hero CTA → land on `/booking-request` → catalog renders → fill form with invalid email → submit → email field shows error → fix → submit → success state → admin push + email arrive → admin opens new booking from `/bookings?status=new-requests`. Each step a checkbox.

Wire (1) + (2) into `npm run smoke:public` so they're rediscoverable. Don't run them in CI yet — they need a deployed prod target; CI doesn't have one.

### E. Manual verification checklist (user runs post-merge)

iter-32 deferred these explicitly to "manual pre-deploy smoke pass". They need human judgement and a running admin instance — the autonomous loop can prepare artefacts but can't make the call. **The iteration is complete when §§A–D ship; §E is queued for the user as a follow-up.**

Generate a single Markdown file at `kb/audits/iter-38-manual-verification.md` containing this checklist for the user to work through:

- [ ] **Focus-ring visibility check.** Tab through every Button variant (default, secondary, destructive, outline, ghost, link) + Input + Select on `/bookings/new`, `/services`, and the user-menu. Confirm focus ring is visible against the bordeaux background in both light and dark mode. Note any low-contrast variant in this file as a finding.
- [ ] **`<StatusBadge>` collision audit.** Open `/bookings`, scroll through several bookings of each status, confirm `default` (bordeaux) and `destructive` (alert red) variants are visually distinguishable. If any two badge colours collide post-bordeaux, file an iter-38b adjustment to the variant map.
- [ ] **Sidebar active-nav highlight check.** Click between `/`, `/bookings`, `/services`, `/users`, `/my-bookings`. Confirm the active nav item is visibly highlighted using `--sidebar-primary`. If `--sidebar-primary` reads as "too close to `--sidebar-background`" in either mode, file a finding.
- [ ] **Existing state banners audit.** Spot-check the amber/green/red banners on `/offer/<token>` (customer page), `/my-bookings/<id>` (squad-member page), `features/bookings/components/AssignmentActionPrompt.tsx` and `WithdrawAssignmentDialog.tsx` against the bordeaux background. Confirm legibility in both modes.
- [ ] **Loading skeleton visual.** Force a slow network throttle (Chrome DevTools), navigate to `/bookings` — confirm the skeleton animation reads coherently against the bordeaux background, not jarring.
- [ ] **Manual dark-mode toggle smoke.** Log in → toggle theme via the user menu (post iter-37 §D.1 or sidebar pre-iter-37) → every page from §C's screenshot list renders coherently in both modes. Destructive buttons still read as "danger" against the bordeaux primary.

After working through this checklist, the user either:
- Marks every box `[x]` and the manual debt is closed.
- Flags items as findings → iter-38b owns the palette adjustment / banner refactor / skeleton fix.

## Done when

- [ ] §A: `chart-2..5` in both `:root` and `.dark` derived from `chart-1` as a bordeaux-anchored family. Static-swatch verification one-off page deleted; only the CSS change lands.
- [ ] §B: `scripts/check-contrast.mjs` present; runs against both light and dark; passes on all required pairs; `--muted-foreground` carve-out documented inline.
- [ ] §C: ~10 baseline screenshots in `kb/screenshots/iter-32-bordeaux/light/` and ~10 in `dark/`. README in that directory explains capture viewport + intent.
- [ ] §D: three smoke scripts present under `scripts/smoke/`; first two wired into `npm run smoke:public`.
- [ ] §E: `kb/audits/iter-38-manual-verification.md` generated with checklist + space for findings.
- [ ] `npm run verify` green; contrast script wired in or invocable.
- [ ] ff-rdp dogfooding session report appended.

## Heads-up

- **Palette adjustments are explicitly out of scope.** If §B surfaces a contrast failure or §E surfaces a visual problem, the *fix* lives in iter-38b. iter-38 is a verification + artefact-production iteration.
- **iter-37 (pickup list)** is the sibling iteration. Independent; either can ship first. If iter-37 §D.1 lands first (theme toggle moved into user menu), §E's manual dark-mode smoke walks the new path.
- **iter-22 invoice flow** still deferred. When it lands, the bordeaux-anchored `chart-2..5` from §A is the family it consumes.
- **Lighthouse baseline (iter-34 §3 deferred)** is not part of this iteration — that's homepage-side, the bordeaux work is admin-side. Capture it as part of the next homepage-SEO-touching iteration.
- **iter-36 KB wiki restructure** doesn't gate this. If iter-36 lands first, paths to `design-system.md` rules in this plan's prose may need a one-line update to point at the new sub-pages.
