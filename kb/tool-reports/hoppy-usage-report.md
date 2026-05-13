---
title: Hoppy CLI Usage Report
type: tool-report
tool: hoppy
date: 2026-04-20
status: active
---

# Hoppy CLI Usage Report

Report on using `hoppy` (bunny.net CLI) to deploy a Next.js app to Magic Containers with CDN and DNS.

## Environment

- hoppy location: `~/.cargo/bin/hoppy`
- Auth: expects `BUNNY_API_KEY` env var

## Commands Used

### Auth

- `hoppy auth check` — validates API key, shows account balance and billing status. Works well.

### Container Management

- `hoppy container app create` — created Magic Container app. Required flags: `--name`, `--runtime-type`, `--min`, `--max`. Optional: `--region`, `--registry-id`, `--image-name`, `--image-namespace`, `--image-tag`. Returns JSON with app ID. Worked smoothly.
- `hoppy container app get --id <id>` — returns full app details including container template IDs, image config, and scaling settings.
- `hoppy container endpoint add` — added CDN endpoint. Required: `--app-id`, `--container-id`, `--name`, `--container-port`, `--cdn`. Returns endpoint ID. The `--container-id` is the template ID from the app, not the app ID itself.
- `hoppy container endpoint list --app-id <id>` — shows endpoint details including the public CDN hostname (e.g. `mc-xxx.b-cdn.net`) and auto-created pull zone ID.
- `hoppy container region list` — lists all available regions with group (EU/NA/SA/etc).
- `hoppy container registry list` — lists configured registries. Pre-existing DockerHub/GitHub public registries plus user-created ones.

### DNS

- `hoppy dns zone create --domain <domain>` — creates DNS zone. Returns zone ID, nameservers, and detection status. Worked perfectly.
- `hoppy dns record add` — adds DNS records. Supports types: A, AAAA, CNAME, TXT, MX, SRV, CAA, PullZone, Flatten, etc. CNAME at apex worked (bunny.net does CNAME flattening). The `Flatten` type returned "Unknown record type" error — had to use `CNAME` instead. The `PullZone` type returned "pull zone ID is not valid" for the auto-created pull zone from Magic Containers — this pull zone doesn't appear in `pull-zone list` either.

### Pull Zone

- `hoppy pull-zone list` — does NOT show pull zones auto-created by Magic Container CDN endpoints. These are invisible to the regular pull zone API.
- `hoppy pull-zone hostname add --id <pullzone-id> --hostname <domain>` — adds custom hostname. Works even for the "invisible" Magic Container pull zones when you know the ID from the endpoint details.
- `hoppy pull-zone hostname load-free-cert --hostname <domain>` — loads Let's Encrypt cert. Note: does NOT take `--id` flag (unlike other hostname commands). Worked quickly.
- `hoppy pull-zone hostname force-ssl --id <id> --hostname <domain> --enabled true` — enables force SSL redirect.

## Issues & Friction Points

### 1. Invisible Magic Container Pull Zones

Pull zones auto-created by `container endpoint add --cdn` don't appear in `pull-zone list`. This is confusing — you need to get the pull zone ID from `container endpoint list` output and then use it directly with `pull-zone hostname` commands. It works, but the discoverability is poor.

### 2. PullZone DNS Record Type

The `PullZone` record type in `dns record add` doesn't work with Magic Container auto-created pull zones. Error: "The pull zone ID is not valid." Had to use a plain `CNAME` record pointing to the b-cdn.net hostname instead.

### 3. Flatten DNS Record Type

`dns record add --type Flatten` returned "Unknown record type" even though it's listed in the help text. Possibly a backend API mismatch.

### 4. Inconsistent Flag Patterns

`pull-zone hostname load-free-cert` does NOT accept `--id` for the pull zone, while `force-ssl` and `add` do. The cert command auto-discovers the pull zone from the hostname, which is convenient but inconsistent.

### 5. Container Name vs Template Name

The `BunnyWay/actions/container-update-image` GitHub Action expects the container template name (e.g. `wardrobe-assistants.ch`), not the app name (`wardrobe-assistants`) or a generic default like `app`. The docs example uses `app` which is misleading unless you name your template that way.

## What Worked Well

- Creating and configuring the full stack (container + CDN + DNS + SSL) was possible entirely from the CLI.
- `--format json` output is consistent and parseable.
- SSL certificate issuance was near-instant.
- DNS zone creation auto-detected that nameservers were already pointing to bunny.net.
- The CDN endpoint auto-provisioning (creating a pull zone behind the scenes) is convenient once you understand the model.

## Suggested Improvements

1. Show Magic Container pull zones in `pull-zone list` (perhaps with a flag or label).
2. Fix the `Flatten` record type or remove it from the help text.
3. Make `PullZone` DNS record type work with Magic Container pull zones.
4. Standardize `--id` usage across all `pull-zone hostname` subcommands.
5. Add a `container deploy` quickstart that chains app create → endpoint add → DNS setup.

## Iter-9 follow-up (2026-05-05) — homepage + admin go-live planning

Re-running pre-flight for iter-9 (`kb/iteration-09-go-live-bunny-infra.md`) confirms both bugs in `kb/hoppy-bug-report-pullzone-storagezone.md` are still present in `hoppy 0.1.0`:

- Issue 1 (cannot bind Storage Zone via `pull-zone create`) — `curl` fallback baked into `kb/runbook-go-live.md` step 2.
- Issue 2 (`pull-zone get` deserialization on Magic Container PZs) — old container's auto Pull Zone (id `5719318`) still invisible in `pull-zone list`. Pre-state JSON lists it under `pull_zones_hidden` so the rollback path is recoverable.

New gap surfaced during iter-9 planning:

### 6. No CLI surface for bunny.net Database

The libSQL DB has to be provisioned via the bunny dashboard. There's no `hoppy database` subcommand. For an automation-first CLI, this is the biggest hole left after `pull-zone create --storage-zone-id`. Filing as a feature request rather than a bug — but worth flagging because it forces a context switch in the middle of an otherwise-scriptable runbook.

### 7. Env-var management on Magic Container apps is dashboard-only

`hoppy container app create` accepts the registry/image flags but no `--env KEY=VAL` repeatable flag. Setting `DATABASE_URL`, `BETTER_AUTH_SECRET`, etc. on the admin container requires either the dashboard or a direct API call. Same friction as Database — captured in the runbook so the next operator doesn't waste time hunting for the flag.

## Iter-11 follow-up (2026-05-07) — IaC migration + snapshot

Used hoppy intensively to (a) snapshot all bunny.net resources for the IaC migration and (b) verify drift against the snapshot at start of iter-11. Two new bugs surfaced, several existing gaps closed, and the new `db` subcommand made the database half of the work tractable.

### What's improved

- **`hoppy db ...` subcommand fills the gap from gap #6 above.** `db list/get/versions/statistics/token/restore/group` cover the full libSQL lifecycle. `db versions` + `db restore` is now the project's DR primitive for the database — no need for an external libSQL `.dump` script. `db token mint` removes the dashboard dependency for new auth tokens.
- **`--reveal-env <KEY>` flag is excellent.** Per-key opt-in revelation matches the project's redact-by-default policy from memory `redact_bunny_app_envvars`. Saves a lot of "I want one value, not all of them."
- **`--record <DIR>` flag is a great escape hatch.** Whenever the typed deserialiser fails, recording raw responses for offline replay is the right shape.

### Bugs hit during iter-11

#### Bug A — `container app get` fails on lowercase `protocols: ["tcp"]`

```text
failed to decode success response: unknown variant `tcp`,
expected one of `Tcp`, `Udp`, `Sctp` at line 1 column 1979
```

Bunny's API now returns `tcp` lowercase; hoppy's enum still expects PascalCase. Breaks every `container app get` against an app with an endpoint port mapping. Workaround: `--debug` + `grep '<<< '` to read the raw body. Same shape as the OriginType=5 bug — provider tightened its enum-string matching faster than its tolerance for upstream casing.

**Fix idea:** deserialise enum-like strings case-insensitively, or match against a `#[serde(alias = "tcp")]` set per variant.

#### Bug B — `--debug` body output bypasses redaction entirely

The `<<< {body}` line on `--debug` is the literal API response, including secret values. Hit this twice: once on `pull-zone get --id <admin-pz>` (cert key fields were null, so harmless), once on `container app get` (env-var values came through plaintext, including `BETTER_AUTH_SECRET`, `DATABASE_AUTH_TOKEN`, `RESEND_API_KEY`).

The redact pipeline only kicks in for hoppy's *normalised* output, not for `--debug`'s pre-deserialise dump. So when bug A or the OriginType=5 bug forces an operator into `--debug` to recover, they get the unredacted view as a side effect — even if they only wanted to read non-secret fields.

**Fix idea:** apply a JSON-key-name redaction pass to `--debug`'s body output too (e.g. any field whose path matches `*.environmentVariables[*].value`, `*.password*`, `*.token`, `*.certificateKey`). Cheap to implement, removes the foot-gun.

### Pre-existing gaps re-confirmed in iter-11

#### Gap 1 — `pull-zone get` returns slim/incomplete fields

Hoppy's `--format json pull-zone get` strips fields like `EnableSmartCache`, `EnableLogging`, optimizer settings, log forwarding, geo zones, edge rules, etc. The `--debug` body has them all. Means TF imports against hoppy's view alone would miss real config. We had to use `--debug` + `grep '<<< '` to capture full pull-zone state.

**Fix idea:** make the typed model a superset of the API response, not a strict subset. Default verbose, opt-in compact via flag.

#### Gap 2 — inconsistent flag names across subcommands

- `hoppy pull-zone get --id <id>`
- `hoppy container app get --id <id>` ✓
- `hoppy container app autoscaling-get --app-id <id>` ✗ (different)
- `hoppy container app region-settings-get --app-id <id>` ✗ (different)
- `hoppy shield zone get-by-pullzone --pull-zone-id <id>` ✗ (different again)
- `hoppy container endpoint list --app-id <id>` (now consistent within container)

**Fix idea:** every command takes `--id` for its primary subject. Cross-references (e.g. shield-zone-by-pullzone) take `--pullzone-id` or similar fully-qualified names. Hidden aliases for backward compat are cheap.

#### Gap 3 — `pull-zone hostname` lacks `list`

Listing custom hostnames on a pull zone requires `pull-zone get` and reading `.Hostnames[]`. Add a `pull-zone hostname list --id <pullzone-id>` for symmetry with other `hostname` subcommands.

#### Gap 4 — `dns zone get --id` is single-form; no plural variant

Have to use `dns zone list` then filter, or pass `--id` if known. Could accept domain-name as alternative key (`--domain`).

#### Gap 5 — `db config` parent help text is silently captured when redirected

Running `hoppy db config > out.json` writes nothing to stdout but exits 0 + dumps help to stderr. Easy to miss and ends with empty/nonsense file. Either require a subcommand or print "use `db config show|limits|optimal`".

#### Gap 6 — pull-zone `edge-rule list` implicitly does a `pull-zone get`

The HTTP debug shows the only request `edge-rule list` makes is `GET /pullzone/<id>` — it then extracts `EdgeRules` from the body. So when `pull-zone get` deserialise fails (OriginType=5), `edge-rule list` fails identically. Fine logically; surprising in error messages because the "command" wasn't `pull-zone get`. A hint in the error like "edge-rule list reads from the parent pull zone resource" would help.

#### Gap 7 — no storage-zone password rotation

`hoppy storage-zone update` exposes 404-redirect / origin-url settings but not "reset password" / "regenerate access key." Rotation requires the dashboard. For an account where every storage zone's password is also a long-lived secret in CI, the current state is a manual chore.

**Fix idea:** `hoppy storage-zone reset-password --id <id>` and `--reset-readonly-password`, returning the new value (under `--reveal`).

### Friction summary (rough effort cost during iter-11)

| Issue | Effort cost | Workaround |
|---|---|---|
| `container app get` lowercase `tcp` | 5 min + risk of leaking secrets | `--debug` body grep |
| `pull-zone get` slim view | 10 min | `--debug` body grep |
| Flag name inconsistency | 2 min × 3 retries each session | re-read help |
| `--debug` bypasses redaction | secrets ended up in conversation context | manual care |
| `db config` silent help-on-redirect | 1 min | not a real blocker |

Net: hoppy is overwhelmingly the right tool for managing this account from the CLI — just needs the redact-on-debug fix and one round of enum-tolerance work to be non-foot-gun.
