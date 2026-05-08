---
title: Hoppy bug report — missing bunny.net Database (libSQL) CLI support
type: tool-report
tool: hoppy
date: 2026-05-05
status: addressed
hoppy_version: 0.1.0
related:
  - hoppy-bug-report-pullzone-storagezone.md
  - hoppy-bug-report-magic-containers.md
---

> See also: [pull-zone / storage-zone report](hoppy-bug-report-pullzone-storagezone.md) and [magic containers report](hoppy-bug-report-magic-containers.md). The MC report's bottom contains a [cross-reference index](hoppy-bug-report-magic-containers.md#cross-reference-index-of-all-hoppy-gaps-from-iter-7a--iter-9) of all 12 hoppy issues surfaced from iter-7a + iter-9.

# Hoppy bug report — missing bunny.net Database (libSQL) CLI support

Report from iter-9's admin go-live (2026-05-05). Provisioning a bunny.net Database (libSQL/SQLite) and minting auth tokens is fully supported by bunny's REST API, but `hoppy 0.1.0` exposes no commands for it. The full provisioning was driven by direct `curl` calls — captured below as the canonical workaround and as the design input for adding a `hoppy db` subcommand.

## What works fine via the API (and should be in `hoppy`)

bunny.net Database has a clean REST API at `https://api.bunny.net/database`, OpenAPI spec at `https://api.bunny.net/database/docs/private/api.json`. Auth is the same `AccessKey: $BUNNY_API_KEY` header `hoppy` already uses elsewhere.

## Walkthrough — the curl workaround used in iter-9

### 1. Discover regions (read-only)

```bash
curl -sS -H "AccessKey: $BUNNY_API_KEY" \
  "https://api.bunny.net/database/v1/config" \
  | jq '{ storage_region_available: .storage_region_available, eu_primary_regions: [.primary_regions[] | select(.group=="EU") | {id, name, country: .country.alpha2}] }'
```

Returns:
- `storage_region_available`: `eu-west-1` (Europe), `us-east-1` (North America). Two flat regions for at-rest storage.
- `primary_regions`: array of compute-region codes (`AMS`, `DE`, `FR`, `UK`, `AT`, `CZ`, …). For Switzerland-targeted deploys, `DE` (Frankfurt) is the closest.

### 2. Create a database

The v1 endpoint takes `slug` + `group` (a DatabaseGroup id). The v2 endpoint takes `name` + `storage_region` + `primary_regions[]` + `replicas_regions[]` and creates an implicit group. v2 returned **HTTP 500 "Internal error"** in this run — we fell back to v1.

There was already an empty DatabaseGroup in the account (id `group_01KKPNWQQ846P1RP4HTN1MWQ1A`, primary region `DE`), so we reused it:

```bash
curl -sS -X POST -H "AccessKey: $BUNNY_API_KEY" -H "Content-Type: application/json" \
  "https://api.bunny.net/database/v1/databases" \
  -d '{"slug":"wa-admin-prod","group":"group_01KKPNWQQ846P1RP4HTN1MWQ1A"}'
```

Returns:
```json
{
  "database": {
    "id": "db_01KQV95KJ611YYT48VSZKHC495",
    "name": "wa-admin-prod",
    "url": "libsql://01KKPNWQQ846P1RP4HTN1MWQ1A-wa-admin-prod.lite.bunnydb.net/",
    "group_id": "group_01KKPNWQQ846P1RP4HTN1MWQ1A",
    "size_max": "1024.0 MB",
    "current_size": "0 B"
  }
}
```

> **Gotcha (slug length):** an earlier attempt with slug `wardrobe-assistants-admin` returned `{"error":"Internal error"}`. Slug `wa-admin-prod` (13 chars) worked. There's no documented length limit — a CLI wrapper should validate locally and surface a friendly error before hitting the API.

### 3. Mint auth tokens

Two tokens — one full-access (admin runtime), one read-only (future homepage CI build step that reads service-catalog data at build time):

```bash
DB_ID=db_01KQV95KJ611YYT48VSZKHC495
curl -sS -X POST -H "AccessKey: $BUNNY_API_KEY" -H "Content-Type: application/json" \
  "https://api.bunny.net/database/v1/databases/$DB_ID/auth/tokens" \
  -d '{"authorization":"full-access"}'
# returns {"token":"<jwt 270 chars>", "expires_at":null}

curl -sS -X POST -H "AccessKey: $BUNNY_API_KEY" -H "Content-Type: application/json" \
  "https://api.bunny.net/database/v1/databases/$DB_ID/auth/tokens" \
  -d '{"authorization":"read-only"}'
```

Tokens are JWTs (~270 chars each). The `authorization` enum is exactly `"full-access"` or `"read-only"`. `expires_at` is optional (RFC 3339 datetime); if omitted the token is valid until JWT secrets are invalidated via `/v1/databases/{db_id}/auth/invalidate`.

### 4. Verify connectivity (read-only)

The libSQL HTTP protocol responds at the database URL path `/v2/pipeline`, with `Authorization: Bearer <token>`:

```bash
curl -sS -X POST "https://01KKPNWQQ846P1RP4HTN1MWQ1A-wa-admin-prod.lite.bunnydb.net/v2/pipeline" \
  -H "Authorization: Bearer $(cat /tmp/wa-secrets/db-token-full)" \
  -H "Content-Type: application/json" \
  -d '{"requests":[{"type":"execute","stmt":{"sql":"SELECT 1 AS ok"}},{"type":"close"}]}'
```

Returns the SELECT result. Useful for "is provisioning done?" CI gates.

## Suggested `hoppy` CLI shape

Mirror the existing `pull-zone` / `storage-zone` patterns:

```text
hoppy db --help
  list                    GET  /v1/databases
  get      --id           GET  /v1/databases/{db_id}
  create   --name --group [--slug] [--storage-region] [--primary-regions]
                          POST /v1/databases  (v1)  or
                          POST /v2/databases  (v2; flag to choose)
  delete   --id           DELETE /v1/databases/{db_id}
  fork     --id --target  POST /v1/databases/{db_id}/fork
  restore  --id --version POST /v1/databases/{db_id}/restore
  versions --id           POST /v1/databases/{db_id}/list_versions
  ping     --id           Convenience: SELECT 1 against /v2/pipeline

hoppy db group --help
  list                    GET  /v1/groups
  get      --id           GET  /v1/groups/{group_id}
  create   --display-name --storage-region --primary-regions [--replicas-regions]
                          POST /v1/groups
  delete   --id           DELETE /v1/groups/{group_id}
  stats    --id           GET  /v1/groups/{group_id}/stats
  usage    --id           GET  /v1/groups/{group_id}/aggregated_usage
  generate-keys --id      POST /v1/groups/{group_id}/auth/generate
  invalidate-keys --id    POST /v1/groups/{group_id}/auth/invalidate

hoppy db token --help
  mint     --db-id --authorization=<full-access|read-only> [--expires-at <RFC3339>]
                          POST /v1/databases/{db_id}/auth/tokens
  invalidate --db-id      POST /v1/databases/{db_id}/auth/invalidate
```

### Design notes

- **`hoppy db ping --id <id>`** is high-value for runbooks. After provisioning, the CLI can confirm the DB is actually reachable and authorising — same role `hoppy auth check` plays for the API key.
- **Slug validation.** The "Internal error" on long slugs is a footgun. Validate locally (`^[a-z][a-z0-9-]{0,N}$`, where `N` is whatever bunny actually enforces — find by trial or ask bunny support) and surface a clean error message.
- **Region helpers.** A `hoppy db config` read-only command exposing `/v1/config` (regions, limits) means operators don't need to remember `DE`, `eu-west-1`, etc. Could also default `--primary-regions` to the optimal region from `/v1/config/optimal_single` (note the `cdn_server_token` requirement on that endpoint — same gap as `optimal`).
- **Don't double-encode the URL.** Database URLs are `libsql://<group_id>-<slug>.lite.bunnydb.net/` — preserve casing and trailing slash exactly as bunny returns them so libSQL clients don't reject them.
- **Token redaction.** When printing tokens (e.g. `hoppy db token mint`), default to a redacted summary (`length=270, type=full-access, expires_at=null`) and require an explicit `--reveal` to print the JWT. Operators frequently pipe `hoppy` output to logs.

## v2 endpoint Internal Error — separate sub-bug

The v2 path `POST /v2/databases` returned `{"error":"Internal error"}` for a payload that satisfied its OpenAPI schema (`name`, `storage_region`, `primary_regions[]`, `replicas_regions[]`). The v1 endpoint succeeded with the equivalent shape.

Looks like a server-side bunny.net issue rather than a client/CLI bug. Worth flagging when filing the hoppy issue in case bunny's team is also paying attention.

## Test cases for `hoppy db` (when implemented)

1. `hoppy db create --name foo --slug foo --group <id>` — succeeds, prints id + url + group.
2. `hoppy db ping --id <id>` against a freshly-created DB — returns OK within 30s.
3. `hoppy db token mint --db-id <id> --authorization=full-access` — returns a JWT; `--reveal` prints it, default redacts.
4. `hoppy db delete --id <id>` — succeeds; `hoppy db get --id <id>` returns 404.
5. `hoppy db create --slug <very-long-slug>` — local validation fails before the API call, friendly error.
6. Auth-token tests round-trip: mint → use against `/v2/pipeline` → invalidate group keys → token now rejected.

## Where this came up

iter-9 admin go-live (2026-05-05). Three `hoppy` gaps surfaced from this iteration:

1. `pull-zone create` doesn't bind StorageZoneId — see `kb/hoppy-bug-report-pullzone-storagezone.md`.
2. `pull-zone get` deserialization breaks on Magic-Container-backed PZs — same file, issue 2.
3. `storage-zone get` strips `Password` and `ReadOnlyPassword` from the response — workaround via `curl https://api.bunny.net/storagezone/{id}`. Worth folding into the existing bug report as issue 3.
4. **This report:** no `db` / `database` subcommand at all.

If hoppy is the canonical operator CLI, every iteration that adds infrastructure surfaces a few gaps. Worth treating each iteration's "what hoppy didn't have" as a recurring section in the post-cutover capture, so the gaps accumulate into prioritised work for hoppy itself.
