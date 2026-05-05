---
title: Hoppy bug report — Pull Zone ↔ Storage Zone binding + help text gaps + storage-zone get strips passwords
type: tool-report
tool: hoppy
date: 2026-05-05
status: active
hoppy_version: 0.1.0
---

# Hoppy bug report — Pull Zone ↔ Storage Zone binding + help text gaps

Report from a real provisioning task on 2026-05-05: trying to stand up a Storage-Zone-backed Pull Zone for the wardrobe-assistants.ch homepage as part of iter-7a's static-export deploy. Workaround was direct `curl` against the bunny.net REST API.

## What went well

These all worked first try and saved real time:

- **`hoppy storage-zone create --name <N> --region <R> --zone-tier 0`** — clean, returned full JSON including `Id`, `StorageHostname`, `Region`. Exactly what was needed to chain into the next step.
- **`hoppy storage-zone delete --id <ID> --yes`** and **`hoppy pull-zone delete --id <ID> --yes`** — quick rollback when the user changed plans. No surprises.
- **`hoppy --format json`** vs **`--format text`** — the JSON output is well-structured, easy to pipe through `python3 -c 'import json,sys;...'` or `jq`. The `text` format is genuinely compact and tab-separated, which is great for grep/awk pipelines.
- **`hoppy dns zone list` / `dns record list --zone-id <id>`** — listing DNS state was painless and authoritative.
- **`BUNNY_API_KEY` env-var auth** — no config file dance, just export and go. Right call for a CLI.
- **`--yes` flag** for skipping prompts in scripted/agent contexts — well-named and consistently honored.
- **Subcommand structure** — `pull-zone hostname add | remove | load-free-cert | force-ssl` is discoverable and maps cleanly onto the operations a human (or an LLM) actually wants to do.
- **Rich error messages** when the bunny API rejects something. Example: `bunny.net API error 400 (pullzone.hostname_already_registered): The hostname is already registered.` — the error code AND human-readable message both surface, which made root-causing trivial.

## Bugs

### Issue 1 — `pull-zone create` cannot bind to a Storage Zone (primary blocker)

**Severity:** High — blocks the most common Pull-Zone-with-static-files workflow.

**What I tried:**

```bash
hoppy pull-zone create --help
# Usage: hoppy pull-zone create [OPTIONS] --name <NAME> --origin-url <ORIGIN_URL>
```

There is no `--storage-zone-id` flag. `--origin-url` is required. For Storage-Zone-backed Pull Zones, `OriginUrl` is empty in bunny's API and the binding happens via `StorageZoneId` (integer).

**Workaround that worked:**

```bash
curl -X POST https://api.bunny.net/pullzone \
  -H "Content-Type: application/json" \
  -H "AccessKey: $BUNNY_API_KEY" \
  -d '{"Name":"wardrobe-assistants","StorageZoneId":1497998,"Type":0}'
```

Response confirmed `OriginUrl: ""` and `StorageZoneId: 1497998` set — bunny accepts both modes natively.

**Suggested CLI shape:**

```text
hoppy pull-zone create --name <NAME>
    (--origin-url <URL> | --storage-zone-id <ID>)
    [--type <premium|volume>]   # bunny's Type field, currently not exposed
```

- Make `--origin-url` and `--storage-zone-id` a mutually-exclusive required-one-of arg group (clap supports this via `ArgGroup` with `required(true).multiple(false)`).
- Add the same pair to `hoppy pull-zone update` (currently also only `--origin-url`).
- Bonus: surface bunny's `Type` enum (Premium/Volume) — not exposed today.

**Reference:** `POST https://api.bunny.net/pullzone` — fields `Name`, `OriginUrl`, `StorageZoneId`, `Type`. Bunny docs: https://docs.bunny.net/reference/pullzonepublic_add

---

### Issue 2 — `pull-zone get` deserialization failure on Magic-Container-backed Pull Zones

**Severity:** Medium — read-only command, but breaks introspection of any auto-managed PZ.

**What I tried:**

```bash
hoppy --format text pull-zone get --id 5719318
# Error: failed to deserialise response body: invalid value: 5, expected one of: 0, 2, 3, 4 at line 1 column 4779
```

The Pull Zone exists and serves traffic fine — it's the auto-managed PZ for an active Magic Container (`lzGns1pTQLcqOGM`). hoppy rejects the response because some enum field returned `5`, which isn't a recognised variant.

**Likely cause:**

Column 4779 in a Pull Zone payload is most likely one of:
- `OriginType` — bunny appears to have added a new value (e.g. `5 = MagicContainerEndpoint`) for container-backed origins.
- `Type` (PullZoneType / tier).
- `CertificateProvisionType` (per-hostname).

`OriginType: 5` is the strongest suspect given this PZ is the auto-PZ of a Magic Container.

**Fix direction:**

The most resilient fix is a catch-all variant on the enum:

```rust
#[derive(Deserialize)]
#[serde(from = "i32")]
pub enum OriginType {
    Public,
    StorageZone,
    LoadBalancer,
    EdgeScript,
    MagicContainer,    // new
    Unknown(i32),      // safety net
}
```

…or `#[serde(other)]` on a catch-all variant. Bunny adds enum values without bumping API versions, so every typed enum is a future deserialization-bomb without a fallback.

**To pinpoint the field:**

```bash
curl -s https://api.bunny.net/pullzone/5719318 -H "AccessKey: $BUNNY_API_KEY" | jq
```

…then look for any field with value `5`. Happy to capture the raw response if useful.

---

## Issue 3 — `storage-zone get` strips `Password` and `ReadOnlyPassword`

**Severity:** High. The Storage Zone password is required to set the `BUNNY_STORAGE_PASSWORD` GitHub secret used by the deploy workflow's `bunnycdn-storage-deploy` action — and to do any direct uploads via the bunny Storage API. Without it, the Storage Zone is effectively write-locked from anywhere outside the bunny dashboard.

**What I tried (iter-9 admin go-live, 2026-05-05):**

```bash
hoppy --format json storage-zone get --id 1498270 | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('keys:', sorted(d.keys()))
print('Has Password:', 'Password' in d, 'Has ReadOnlyPassword:', 'ReadOnlyPassword' in d)
"
# keys: ['Custom404FilePath','DateModified','Deleted','Discount','FilesStored',
#        'Id','Name','PriceOverride','PullZones','Region','ReplicationChangeInProgress',
#        'ReplicationRegions','Rewrite404To200','StorageHostname','StorageUsed',
#        'StorageZoneType','UserId','ZoneTier']
# Has Password: False  Has ReadOnlyPassword: False
```

`storage-zone create` also doesn't return them. So `hoppy` exposes no path to retrieve them at all.

**What bunny actually returns:**

```bash
curl -sS -H "AccessKey: $BUNNY_API_KEY" "https://api.bunny.net/storagezone/1498270" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('len:', len(d.get('Password','')))"
# len: 41
```

`Password` and `ReadOnlyPassword` are 41-char strings in the raw response. `hoppy` strips them in its `StorageZone` deserializer (the Rust struct doesn't carry the field, so serde drops it).

**Fix direction:**

Add `password: Option<String>` and `read_only_password: Option<String>` to the `StorageZone` struct (`#[serde(default)]` so listing endpoints that don't return them stay happy). Then for safety, default to redacting them in CLI output:

- `hoppy storage-zone get` — JSON output omits the password fields by default; help text notes that passwords aren't in default output.
- `hoppy storage-zone get-password --id <id> [--read-only] [--reveal]` — explicit, opt-in. Default prints `<set, length=41>`; `--reveal` prints raw. Operators frequently pipe `hoppy` output to logs (CI, recordings, terminal scrollback) — default-redact is the right safety stance.

This pairs naturally with the bunny Magic Containers env-var report (`feedback_redact_bunny_app_envvars` memory): the bunny API surfaces stored secrets in many places; every path that reads them needs the same redact-by-default treatment.

---

## Issue 4 — `pull-zone get` typed-enum deserialisation reaches deeper than just OriginType

(Recapping issue 2 with new evidence from iter-9.) When iter-9 fetched the admin Pull Zone (`5798594`, freshly created and Storage-Zone-backed), `hoppy pull-zone get --id` succeeded — the deserialiser handled this PZ. But the pre-existing auto-managed Pull Zone for the legacy Magic Container (`5719318`) still 500s with the same `expected one of: 0, 2, 3, 4` error. This narrows the bug: the offending value is a property of *Magic-Container-backed Pull Zones specifically*, not Storage-Zone-backed ones. Strong support for `OriginType: 5 = MagicContainerEndpoint` being the unrecognised variant.

The catch-all `Unknown(i32)` fix in issue 2 still applies. Adding a test against an existing Magic-Container-backed PZ in CI would catch future regressions.

---

## What could be improved (general)

### Help-text gaps

The current `--help` output is minimal — flags listed without descriptions. A user/LLM reading `hoppy pull-zone create --help` cannot tell:

- That `--origin-url` is HTTP-origin-only and Storage-Zone binding is unsupported (would have saved ~10 minutes today).
- What `--zone-tier 0|1` actually means (`0 = Standard, 1 = Edge` is in `storage-zone create --help` description, but most other enum-valued flags lack the value→meaning mapping).
- Default values (e.g. `--format` defaults to `table` — shown — but cache TTLs etc. are silent).

**Suggestions:**

1. **Per-flag long descriptions** (clap's `long_help`) — at minimum for any flag that maps to a bunny-API enum or has non-obvious semantics.
2. **Examples in `--help`** for the common subcommands. e.g. for `pull-zone create`:
   ```
   Examples:
     # Pull Zone backed by a Storage Zone (static files)
     hoppy pull-zone create --name my-cdn --storage-zone-id 12345
     # Pull Zone in front of an HTTP origin
     hoppy pull-zone create --name my-cdn --origin-url https://origin.example.com
   ```
3. **Cross-reference related commands** — e.g. after creating a Pull Zone, hint that `hoppy pull-zone hostname add` is the next likely step.
4. **Document feature gaps** — if a flag/feature isn't yet implemented but the API supports it, a short note in the help (`# not yet exposed: --storage-zone-id, see issue #N`) is far better than the user discovering it via a 400 error.

### CLI ergonomics

- **`hoppy dns record list <id>`** rejects positional arg (`error: unexpected argument '775662' found`) but every other `dns record list` example in the wild uses positional. Standardise: either accept positional zone-id everywhere or always require `--zone-id`. Today it's `--zone-id` for `record list` but `--id` for `dns zone get`.
- **Inconsistent `--id` vs `--zone-id` vs positional** — across `pull-zone get --id`, `dns record list --zone-id`, `dns zone get --id` — pick one convention.
- **`container app list`** vs **`container app`** (no subcommand) — when I typed `hoppy container list` (matching `pull-zone list`, `storage-zone list`), hoppy errored out. The fix landed me at `container app list`, but the asymmetry is surprising. Consider aliasing top-level `container list` → `container app list`.
- **`hoppy --version`** prints `hoppy 0.1.0` — consider including build SHA + bunny-API-version-tested-against, especially for a CLI that wraps a moving API.

### Error message quality

Already good when bunny returns a structured error. Could be improved when hoppy itself errors:

- Issue 2's `failed to deserialise response body: invalid value: 5, expected one of: 0, 2, 3, 4 at line 1 column 4779` — the user has no way to act on this. Better:
  > `Pull Zone 5719318 has an OriginType value (5) that this version of hoppy does not recognise. This Pull Zone is likely backed by a feature added to bunny.net after hoppy 0.1.0 was released. Try upgrading hoppy, or use the bunny dashboard for now.`
- Generally, route deserialization errors through a translator that maps `column N` → field name.

---

## Suggested test cases to add

1. Create a Storage Zone, then a Pull Zone with `--storage-zone-id <id>`. Assert `StorageZoneId` is set and `OriginUrl == ""`.
2. Update an existing Pull Zone's `--storage-zone-id`. Assert binding flips.
3. `pull-zone get` against an auto-managed (Magic-Container-backed) Pull Zone. Should not panic on unknown enum values; should round-trip through hoppy's parser.
4. `pull-zone create` with neither `--origin-url` nor `--storage-zone-id` should produce a friendly clap error, not a runtime API 400.
5. `pull-zone create` with **both** flags should error early with "mutually exclusive".

---

## Provisioning task this came from

iter-7a (workspace foundation, merged 2026-05-05 as `ccb25a7`) introduced a static-export homepage that needs to be uploaded to a bunny Storage Zone and served via a Pull Zone. The provisioning attempt that surfaced these bugs was rolled back — both the Storage Zone (`wardrobe-assistants-homepage`, id `1497998`) and the Pull Zone (id `5797494`) were deleted before any DNS/hostname changes landed. Live site is unaffected and still served by the existing Magic Container's auto Pull Zone (`5719318`). Provisioning will be retried in a later iteration once the workspace rename has landed.
