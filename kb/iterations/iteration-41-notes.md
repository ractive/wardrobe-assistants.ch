---
title: Iteration 41 — implementation notes
type: iteration-notes
order: 42.5
status: complete
---

# Iteration 41 — implementation notes

Postmortem of the same-day implementation of iter-41 §A–F. The plan landed via the ralph-loop in the morning; production-readying it took the rest of the day across a chain of surprises documented below.

## §A — CI secrets pipeline: two consecutive shell-quoting bugs

**Bug 1: `gh secret set NAME --body -` sets the literal string `"-"`.** `--body` is a value parameter; passing `-` does **not** mean "read from stdin." Stdin reading is the default (no `--body` flag at all). Symptoms: every storage upload returned 401 because the `AccessKey` header value was the single character `-`. Surfaced via a temporary `RUN echo "STORAGE_ZONE len: ${#STORAGE_ZONE}"` diagnostic in the Dockerfile that printed `len: 1` for both secrets.

**Fix:** `printf '%s' "$VAL" | gh secret set NAME` (no `--body` flag).

**Bug 2: `jq -r .field` appends a newline.** Even with correct stdin invocation, `... | gh secret set ...` was storing the value with a trailing `\n`. The 41-character password became 42 bytes; bunny rejected with 401. Surfaced when a direct laptop curl with the same password worked but the CI step failed.

**Fix:** `printf '%s'` instead of `echo` or letting `jq`'s trailing newline through.

Both lessons saved to memory at `feedback_gh_secret_no_newline.md`.

## §B — Turbopack red herring (~1h)

When the first iter-41 deploy completed and live HTML still emitted relative `/_next/static/...` paths, hypothesised Next 16's default Turbopack builder ignored `assetPrefix`. Spent considerable effort:

- Inspecting the served `turbopack-*.js` chunk runtime (`let t="/_next/"`).
- Tracing the assetPrefix flow through `next.config.ts` → Dockerfile ARG → ENV → `next build`.
- Adding a temporary `RUN echo "ADMIN_ASSET_PREFIX length: ${#ADMIN_ASSET_PREFIX}"` to confirm the env reached `next build`.
- Forcing a `next build --webpack` build (failed because route-group chunks like `_next/static/chunks/app/(public)/offer/[token]/error-*.js` triggered curl URL globbing — fixed with `--globoff` on the upload step).

The real explanation surfaced from a clean local turbopack build: `ADMIN_ASSET_PREFIX=https://example-cdn.test npx next build --turbopack` correctly emitted `let t="https://example-cdn.test/_next/"` in the chunk runtime and `"assetPrefix": "https://example-cdn.test"` in `required-server-files.json`. Turbopack honoured `assetPrefix` all along. The "relative paths in prod HTML" evidence was **bunny edge cache serving stale HTML from before the iter-41 container was live**.

Lesson saved at `feedback_check_bunny_edge_cache_before_concluding.md`: sample HTML 5–10 times during rolling deploys, and confirm `hoppy container app get` reports `status: active` (not `progressing`) before drawing conclusions.

## §C — Compounding non-bugs left in the diff

The `--webpack` build attempt also produced two changes that turned out unnecessary:

- `apps/admin/package.json` → `"build": "next build --webpack"` — reverted to plain `next build`.
- A flawed `next.config.ts` comment claiming Turbopack ignores `assetPrefix` — removed.

`--globoff` on the upload curl is kept as defense in depth: turbopack chunk filenames are URL-safe (`~ . _ -` only) so it didn't bite us, but a future migration back to webpack or a path-aware build tool would re-hit the route-group globbing reject.

## §D — CSP gap (the open question we hand-waved)

The iter-41 plan §C ("Open questions to resolve before scoping") had a bullet labelled **"CSP impact"**:

> The admin sends `script-src 'self' 'nonce-…' 'strict-dynamic'` from `src/proxy.ts`. `strict-dynamic` propagates trust from the nonced bootstrap script to scripts it loads, regardless of origin — so in theory no CSP change is needed. To be verified end-to-end in dev with `connect-src` left as `'self'`…

Hand-waved as "in theory no CSP change is needed" with verification deferred to "the first deploy." First deploy duly surfaced:

```
Content-Security-Policy: Die Einstellungen der Seite haben die Anwendung
eines Styles (style-src-elem) auf
https://wardrobe-assistants-admin-static.b-cdn.net/_next/static/chunks/03c.0jngc~m5p.css
blockiert, da er gegen folgende Direktive verstößt: "style-src 'self'
'unsafe-inline'"
```

`'strict-dynamic'` only propagates trust within `script-src`. Stylesheets, fonts, and images still need explicit host allowlists. The cross-origin asset host needed CSP carve-outs for `style-src`, `font-src`, `img-src` (and possibly `connect-src`).

Rather than carve out across three directives, pivoted to the same-origin edge-rule architecture (§F in the plan and ADR-023). Keeps every directive at `'self'`.

Lesson saved at `feedback_csp_assetprefix_lesson.md`.

## §E — Zod v4 JIT probe under CSP

Once the CSS loaded and the page initialised fully on the new architecture, a second CSP violation surfaced:

```
Content-Security-Policy: Die Einstellungen der Seite haben die Ausführung
eines JavaScript-Evals (script-src) blockiert (es fehlt 'unsafe-eval')
0qyq6ist3tdw6.js
```

The chunk at `0qyq6ist3tdw6.js:31605` is Zod v4's JIT detection probe: `try { Function(""), true } catch { false }`. Zod calls `new Function()` on first use to decide between compiled (~6× faster) and interpreted validators. Catch handles the throw and falls back. The CSP violation is logged but non-fatal.

Fixed via a `'use client'` `<ZodClientInit />` component with module-level `z.config({ jitless: true })` mounted in `app/layout.tsx`. Zod docs (`node_modules/zod/v4/core/util.js`) explicitly document this as the intended workaround: "Skip the probe under `jitless`: strict CSPs report the caught `new Function`". PR `colinhacks/zod#5864` (Zod 4.4.0+) made `jitless` actually skip the probe; we're on 4.4.3.

Researched the alternatives before committing:
- **Add `'unsafe-eval'` to `script-src`** — rejected. `'strict-dynamic'` does NOT override the `'unsafe-eval'` keyword; it only ignores host-source lists. Adding `'unsafe-eval'` re-enables `eval`/`new Function` for all admitted scripts.
- **Build-time patch of `zod/v4/core/util.js`** — rejected. Brittle, breaks on upgrades.
- **Bundler alias to a wrapper that calls `z.config`** — rejected. Invasive, no upside.
- **`useEffect`-style init** — rejected. Too late; schemas can parse before mount.

## §F — Rolling-deploy load-balancing surprises

Magic Container rolling deploys ran two pods simultaneously (one new, one old). Bunny pull-zone load-balanced 50/50 across both, so curl results during the rollover alternated between "OLD pod (assetPrefix HTML)" and "NEW pod (relative-path HTML)" between consecutive requests.

Pattern for future rolling-deploy validation:

1. Watch the `gh run watch` background completion notification (Bash `run_in_background: true` returns a `<task-notification>` on exit — primary wake signal).
2. After watch fires, check `hoppy container app get --id $APP_ID --format json | jq '.status'` — wait for `active`, not `progressing`.
3. If you need to force the rollover (e.g. testing under time pressure), use `hoppy container pod recreate` or recreate the old pod via the bunny dashboard. Faster than waiting for bunny's auto-drain.

## §G — Deploy ordering / cleanup

After the §F pivot landed, the GH variable `ADMIN_ASSET_PREFIX` was no longer referenced anywhere in the code. Deleted with `gh variable delete ADMIN_ASSET_PREFIX`.

Secrets `BUNNY_ADMIN_STATIC_STORAGE_ZONE_NAME` and `BUNNY_ADMIN_STATIC_STORAGE_PASSWORD` remain in use (the upload step still ships chunks to the storage zone).

## Lessons for future iterations

1. **Don't hand-wave CSP open questions.** When the plan flags "in theory no CSP change is needed" with verification deferred, treat that bullet as a known risk and budget time for it.
2. **`gh secret set` with secrets-from-stdin needs care.** Use `printf '%s' "$VAL" | gh secret set NAME`. Not `--body -`, not `jq -r | gh secret set --body -`. Both fail silently with values that *look* almost right.
3. **Bunny edge cache lies during rolling deploys.** Always confirm `status: active` and sample 5–10 times before drawing architecture conclusions.
4. **Read library source before claiming "library X doesn't support feature Y".** Turbopack assetPrefix support is documented (the chunk runtime even shows the injection mechanism: `let t="<prefix>/_next/"`). The hypothesis cost ~1h of wrong-direction debugging.
5. **Mid-iteration architectural pivots are OK if the plan and ADR are kept current.** ADR-023 has a `2026-05-13 update` subsection rather than ADR-024; the iter-41 plan has a `§F` postscript. Future readers see the full narrative in one place.
