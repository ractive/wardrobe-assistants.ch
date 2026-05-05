---
title: Hoppy bug report — Magic Containers (env wipe, auto-PZ orphans, list gaps, ergonomics)
type: tool-report
tool: hoppy
date: 2026-05-05
status: active
hoppy_version: 0.1.0
related:
  - hoppy-bug-report-pullzone-storagezone.md
  - hoppy-bug-report-database-cli.md
---

# Hoppy bug report — Magic Containers

Findings from iter-9's admin go-live (2026-05-05). Sister reports cover [Pull Zone / Storage Zone gaps](hoppy-bug-report-pullzone-storagezone.md) and the [missing Database CLI](hoppy-bug-report-database-cli.md). This file is the Magic Containers (MC) surface.

## What works well

- **`hoppy container app create`** returns the new app's id cleanly (`{"id": "<id>"}`).
- **`hoppy container template env --env KEY=VAL`** with repeated `--env` flags works first try; values are accepted verbatim including JWTs and base64 strings.
- **`hoppy container endpoint add --cdn`** wires up a fresh CDN endpoint for the container, including a freshly minted bunny auto-managed Pull Zone bound to it. End-to-end, this command did the right thing on first run.
- **`hoppy container registry list`** is essential for picking the right registry id (5602 for "GitHub Packages ractive", 1155 for DockerHub Public, 1156 for GitHub Public). Should stay.

## Issues

### Issue 1 — `container template env` silently wipes ALL env vars when called with zero `--env` flags

**Severity:** High operational footgun. Documented behaviour in `--help` ("replaces all"), but no guard rail when the "all" being replaced is "with nothing."

**Reproduction:**

```bash
# State: container template has 9 env vars set.
hoppy --yes container template env \
  --app-id h4vme6Uhod4W3Yu \
  --container-id h4vme6Uhod4W3Yu-63yu
# Exit 0, prints template metadata, no warning.
# State: container template has 0 env vars. Sign-in / DB connection / TLS — all broken at next pod start.
```

The "replaces all" semantics is correct per the help text, but the destructive transition from N>0 → 0 entries is exactly the case operators need protected from.

**Symmetric reproduction with one `--env`:** state goes from 9 → 1 — same "replace all" semantics, just to a non-empty target. Equally surprising for operators who expect "set" to mean "add or update."

**This was NOT bunny's PATCH behaviour or BunnyWay/actions:**

iter-9 originally hypothesised that `BunnyWay/actions/container-update-image` was wiping env vars during code deploys. **Investigation refutes this** — see [`bunnyway-actions-investigation.md`](bunnyway-actions-investigation.md). The bunny Magic Containers PATCH endpoint correctly preserves omitted fields; the BunnyWay action's PATCH body `{id, imageTag}` does NOT touch env vars; pod recreate also does not wipe. The wipe in iter-9 was almost certainly an accidental hoppy invocation with the wrong `--env` arg list — exactly the footgun this issue describes.

**Fix direction:**

1. **Refuse zero-`--env` calls by default.** Treating "no args" as "wipe all" is the worst possible default. Either error out (`error: at least one --env required, use --clear to explicitly wipe all`) or require an explicit `--clear` flag.
2. **Require `--allow-clear` for the N>0 → 0 transition.** A destructive call should look destructive at the call site — `--yes` alone is too permissive.
3. **Add granular operations** (see Issue 5 of this report): `--add KEY=VAL`, `--remove KEY`, `--update KEY=VAL`. Most operator updates are "tweak one var without losing the rest." `--replace-all` becomes the explicit name for the current behaviour.
4. **Help text should call out the destructive default loudly.** Current `--help` says "Set environment variables for a container template (replaces all)" — fine, but doesn't surface the "with no `--env` flags = wipe all" edge case.

**Defensive engineering for operators (until upstream is fixed):**

- Always pass the complete env list (every `--env` flag for every var).
- Pull source-of-truth env values from GitHub repo secrets in CI, not from the container template state.
- A CI step after every `BunnyWay/actions/container-update-image` call could reassert the full env list — defensive even though BunnyWay itself isn't the culprit, because any future code path that ends up calling `hoppy template env` with the wrong args (manual operator + future automation alike) is exposed.

---

### Issue 2 — `hoppy pull-zone list` excludes auto-managed Pull Zones

**Severity:** Medium — surprises operators during cleanup; can result in orphaned PZs.

**What I tried:**

```bash
hoppy --format text pull-zone list
# Returns only manually-created PZs, e.g.:
# 5798479  wardrobe-assistants-ch  ...
# (auto-managed PZ 5798594 from the admin Magic Container endpoint is NOT listed)
```

But it exists and serves traffic:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "AccessKey: $BUNNY_API_KEY" \
  "https://api.bunny.net/pullzone/5798594"
# HTTP 200
```

So `hoppy pull-zone list` is filtering out PZs marked as system-managed / auto-created. Operators auditing cleanup state see only the manual PZs and miss the auto-PZ.

**Where it bit me:** during decommission. After deleting the legacy Magic Container `lzGns1pTQLcqOGM`, I expected its auto-PZ `5719318` to be reaped. It wasn't — orphaned PZ left behind, only visible via direct API GET. `hoppy pull-zone list` continued to show only the manually-created homepage PZ. Easy to forget about the orphan and let it linger.

**Fix direction:**

- Either include auto-managed PZs in `list` output (with a column flag like `IsAutoManaged: true`), or
- Add a `--include-auto-managed` opt-in flag, or
- At minimum, the `hoppy container app delete` flow should warn "this app's auto-PZ <id> was not deleted; run `hoppy pull-zone delete --id <id>` to clean up" — either as informational output or by deleting it as part of the same operation behind a `--cascade` flag.

---

### Issue 3 — `hoppy container app delete` orphans the auto-managed Pull Zone

**Severity:** Medium — mirror of issue 2 from the cleanup angle.

**What happened:**

```bash
hoppy --format text --yes container app delete --id lzGns1pTQLcqOGM
# Deleted application lzGns1pTQLcqOGM
# (auto-PZ 5719318 NOT reaped)
sleep 5
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "AccessKey: $BUNNY_API_KEY" \
  "https://api.bunny.net/pullzone/5719318"
# HTTP 200 — still alive

hoppy --format text --yes pull-zone delete --id 5719318
# Deleted pull zone 5719318
```

The auto-PZ continued to exist as a billable resource until I explicitly deleted it. Bunny's API doesn't cascade. `hoppy` could.

**Fix direction:**

- Default behaviour: `hoppy container app delete` should print a list of auto-managed dependent resources (PZs, possibly DNS records bound to them) and either prompt or accept `--cascade` to delete them too.
- If cascading is too risky as default, at least surface them in the success message: `Deleted application <id>. Note: 1 auto-managed Pull Zone (<id>) was NOT deleted; remove with: hoppy pull-zone delete --id <id>`.

---

### Issue 4 — `container app create` return is too thin for a workflow

**Severity:** Low — ergonomic; not a bug, just suboptimal output.

**What returned:**

```json
{ "id": "h4vme6Uhod4W3Yu" }
```

**What I needed next:**

- Container template id (for `template env`) — discovered via `container app get` → `containerTemplates[0].id`.
- Endpoint id (for `endpoint add` / hostname binding) — only exists *after* `endpoint add`, which itself returns `{id, ...}`.
- Auto-PZ id from the endpoint (for hostname/SSL operations) — only available via `app get` *after* `endpoint add`.

So a real provisioning sequence is `create → app get → endpoint add → app get → pull-zone hostname add → …`. Three round trips of `hoppy container app get` to chain the IDs together.

**Fix direction:**

- `hoppy container app create` could optionally return the full app document (matching `app get`) when run with `--format json` or with a `--full` flag. Operators (and especially LLM-driven flows) would then chain in one round trip.
- Alternatively, a higher-level `hoppy container app provision` / `hoppy container app spec` command that takes a single declarative spec (image, env, endpoints, hostnames) and provisions the lot end-to-end. Most operators want this anyway; the granular subcommands are good as primitives but not as a UX.

---

### Issue 5 — `container template env --env` is "replaces all" with no granular alternative

**Severity:** Low — the "replaces all" semantics are documented in `--help`, but every operator who edits env vars over time has to keep the full set in scope, or they lose vars.

This compounds with issue 1: the same "set the whole array" pattern that PATCH-clobbers-env exposes is the only API hoppy gives users.

**Fix direction:**

- `hoppy container template env --add KEY=VAL` (idempotent: add or update by name).
- `hoppy container template env --remove KEY` (idempotent: remove if present).
- `hoppy container template env --replace-all` (current behaviour, made explicit).
- Default behaviour with no flags: print the current env names (NEVER values — see Issue 6 below) and exit 0, like `kubectl get configmap`.

---

### Issue 6 — `container app get` and equivalents return env-var values plaintext (cross-cutting redaction policy)

**Severity:** Medium — recurring footgun for operators (and LLMs) piping output to logs.

**What happened in iter-9:**

```bash
curl -sS -H "AccessKey: $BUNNY_API_KEY" \
  "https://api.bunny.net/mc/apps/h4vme6Uhod4W3Yu" | head -50
```

The response body included plaintext `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `DATABASE_AUTH_TOKEN` values. They appeared in the operator's terminal scrollback and the conversation transcript. The user declined rotation (transcript was local-only) but the burn was real.

`hoppy container app get` and `hoppy container template get` pass these values through unredacted by default (haven't tested directly, but inheriting from the API response would make them just as dangerous).

**Fix direction (cross-cutting policy for hoppy, broader than this issue):**

- **Default redact:** any field with a name matching `*PASSWORD`, `*SECRET`, `*TOKEN`, `*KEY`, `*CREDENTIAL` should print as `<set, length=N>` by default. JSON-format output strips the value; only fields' presence + length surface.
- **Explicit reveal flag:** `--reveal` (or per-field flags, e.g. `--reveal-env DATABASE_AUTH_TOKEN`) prints raw values.
- **Same policy for storage-zone (issue 3 of [pullzone-storagezone report](hoppy-bug-report-pullzone-storagezone.md)) and database token mint (issue 5 of [database-cli report](hoppy-bug-report-database-cli.md))** — apply once, document once, all read-paths inherit.

This would also align with operator memory `feedback_redact_bunny_app_envvars`: bunny APIs surface stored secrets; every client should redact by default.

---

## Suggested test cases to add

1. **Env-preservation test:** create container with 5 env vars → run `app update --image-tag <new>` → assert env still has 5 vars and matching values. Should pass after the issue-1 fix.
2. **Cascade delete:** create container with auto-PZ → `app delete` → assert auto-PZ is gone (or at least surfaced in output).
3. **`pull-zone list` includes auto-PZs:** create container, list, assert auto-PZ row present (after issue-2 fix).
4. **Provisioning round-trip count:** create → endpoint add → bind hostname. Should be doable in ≤2 hoppy invocations after issue-4 fix.
5. **Redaction default:** `container app get` of an app with env vars whose names match secret patterns → assert values are `<set, length=N>` not raw, in JSON, table, and text formats.

---

## Cross-reference index of all hoppy gaps from iter-7a / iter-9

| # | Issue | Where documented |
|---|---|---|
| PZ.1 | `pull-zone create` cannot bind StorageZoneId | [pullzone-storagezone](hoppy-bug-report-pullzone-storagezone.md#issue-1) |
| PZ.2 | `pull-zone get` 500s on MC-backed PZs (typed-enum) | [pullzone-storagezone](hoppy-bug-report-pullzone-storagezone.md#issue-2) + [refinement](hoppy-bug-report-pullzone-storagezone.md#issue-4) |
| SZ.1 | `storage-zone get` strips Password/ReadOnlyPassword | [pullzone-storagezone](hoppy-bug-report-pullzone-storagezone.md#issue-3) |
| DB.1 | No `db` / `database` subcommand at all | [database-cli](hoppy-bug-report-database-cli.md) |
| MC.1 | `template env` with zero `--env` flags silently wipes all env vars | this file, Issue 1 |
| MC.2 | `pull-zone list` excludes auto-managed PZs | this file, Issue 2 |
| MC.3 | `container app delete` orphans the auto-PZ | this file, Issue 3 |
| MC.4 | `container app create` return too thin for workflows | this file, Issue 4 |
| MC.5 | `container template env` only "replaces all" | this file, Issue 5 |
| MC.6 | `container app get` returns env values plaintext | this file, Issue 6 |
| GEN.1 | `--id` vs `--zone-id` vs positional inconsistency | [pullzone-storagezone, "CLI ergonomics"](hoppy-bug-report-pullzone-storagezone.md#cli-ergonomics) |
| GEN.2 | `container list` asymmetry with `pull-zone list` etc. | [pullzone-storagezone, "CLI ergonomics"](hoppy-bug-report-pullzone-storagezone.md#cli-ergonomics) |
| GEN.3 | Help-text minimalism (no examples, no enum descriptions) | [pullzone-storagezone, "Help-text gaps"](hoppy-bug-report-pullzone-storagezone.md#help-text-gaps) |
| GEN.4 | "Internal error" 500 on long slugs (no friendly local validation) | [database-cli, "Gotcha (slug length)"](hoppy-bug-report-database-cli.md#2-create-a-database) |
| GEN.5 | Deserialization errors don't translate to actionable hints | [pullzone-storagezone, "Error message quality"](hoppy-bug-report-pullzone-storagezone.md#error-message-quality) |

12 distinct issues across 3 reports surfaced from a single homepage+admin go-live. Treat each iteration's "what hoppy didn't have" as a recurring section in the post-cutover capture so the gaps accumulate into prioritised work for hoppy itself.
