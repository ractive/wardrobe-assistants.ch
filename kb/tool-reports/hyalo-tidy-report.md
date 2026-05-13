---
title: Hyalo CLI Tidy Report
type: tool-report
tool: hyalo
date: 2026-05-08
status: active
---

# Hyalo CLI Tidy Report

Notes from a `/hyalo-tidy` pass on `kb/` that introduced folder structure (`iterations/`, `iterations/done/`, `iterations/deferred/`, `runbooks/`, `tool-reports/`, `legal/`, `notes/`) and moved 33 files. Captures what worked smoothly and the quirks/issues encountered, so the next tidy run can avoid the same friction.

## What worked well

### `hyalo mv`

- Rewrote outbound links across the entire vault when files moved between folders. This is the headline feature — without it, 33 file moves would have been a full-text-search-and-replace nightmare.
- Worked for both wikilinks and standard markdown links (with the caveat below).
- Idempotent: re-running on already-moved paths is a no-op.

### `hyalo find` with property filters

- `hyalo find --property status=planned --tag iteration --format text` is the right primitive for "show me everything still on the queue."
- `--format text` output is compact and easy to read in a terminal — much better than the JSON default for LLM-driven workflows.
- Property-regex form (`'title~=pattern'`) is handy for fuzzy title matching.

### Schema validation on write

- `validate_on_write = true` in `.hyalo.toml` caught missing required fields immediately on file creation, instead of letting bad frontmatter rot in the vault.
- The `[schema.types.<type>]` tables are easy to extend — adding a new type is a 5-line edit.

### Saved views

- Saving diagnostic views in `.hyalo.toml` (`stale-in-progress`, `missing-status`, `missing-type`, `orphans`, `completed-with-todos`) means future tidy passes can run a single `hyalo views run <name>` instead of re-deriving the right `find` invocation.

### Lint summary

- `hyalo lint` cleanly separated errors (broken links) from warnings (schema gaps), making it easy to triage.

## Quirks and issues

### `hyalo links fix` overcorrected in-folder relative links

**Symptom**: After moving files, `hyalo links fix` rewrote bare-basename links inside the same folder (e.g. `data-layer.md` → `admin-architecture/data-layer.md`) into vault-rooted paths. These then resolved to the wrong location after subsequent moves and broke in renderers expecting relative paths.

**Impact**: Had to manually revert 7 files: `kb/admin-architecture/{overview,data-layer,server-layer}.md` and 4 cross-referencing `tool-reports/*.md` files.

**Workaround**: After `hyalo mv`, prefer to re-run only `hyalo lint` to spot real breakage. Only run `hyalo links fix` if there is a specific known-broken link, and inspect the diff before accepting.

### `../`-relative links flagged as "unresolved"

**Symptom**: 14 standard markdown links using `../` parent traversal (e.g. `../admin-architecture/data-layer.md`, `../../tool-reports/...`) are reported as "unresolved" by `hyalo lint`, even though they resolve correctly on the filesystem and render correctly in Obsidian/GitHub.

**Impact**: Noise in the lint output; cannot easily distinguish real broken links from this false positive.

**Workaround**: Rewrite as `[[wikilinks]]` if you want hyalo to track them, or accept the noise and rely on a renderer for ground truth.

### Plain backtick references aren't rewritten by `mv`

**Symptom**: Prose references like `` `kb/iac-runbook.md` `` (backticked path, not a link) are invisible to `hyalo mv` and get left pointing at the old path after a move.

**Impact**: Stale path strings in frozen iteration plans (`iterations/done/iteration-{08,09,11}*.md`) still reference `kb/iac-runbook.md` instead of `kb/runbooks/iac-runbook.md`.

**Workaround**: Either rewrite frozen-history references with a manual `grep | sed` pass, or accept staleness on point-in-time records (current convention).

### Schema gaps surface as silent warnings

**Symptom**: When existing files use frontmatter fields not declared in the schema (`hoppy_version` on tool-reports, `created` on runbooks, `order` on legal-draft), `hyalo lint` emits warnings but doesn't block. The fields are silently ignored by `find` filters.

**Impact**: A `hyalo find --property hoppy_version=...` filter returns nothing without explaining why.

**Workaround**: Either declare the field in `.hyalo.toml` or remove it from frontmatter. There is no "strict mode" that would have caught this earlier.

### Untyped files in lint output

**Symptom**: `bunny-snapshot-2026-05-07/SUMMARY.md` (a snapshot artefact, intentionally untyped) shows up as a `missing-type` warning.

**Workaround**: Add a `snapshot` schema type, or accept the warning. There's no per-file ignore directive.

### `--format text` is the only LLM-friendly output

The JSON default is verbose and hard to scan. Defaulting to `--format text` would help; in practice every invocation needs `--format text` appended.

## Recommendations for next tidy

1. Run `hyalo lint` *before* `hyalo links fix` and inspect the diff — don't accept fixes blindly.
2. Prefer wikilinks over `../`-relative links inside the vault to keep `hyalo lint` quiet.
3. When introducing folders, audit prose backtick references with a `grep -r` pass — `mv` won't catch them.
4. Keep schema declarations in sync with actual frontmatter usage; treat warnings as errors during tidy.
5. Use saved views (`.hyalo.toml [views]`) to make recurring diagnostics one-liners.
