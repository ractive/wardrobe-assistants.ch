---
title: bunny.net snapshot — 2026-05-07
tags: [snapshot, bunny, infrastructure]
status: archived
date: 2026-05-07
---

# bunny.net snapshot — 2026-05-07

Point-in-time capture of every bunny.net resource backing wardrobe-assistants.ch. Generated with `hoppy` (defaults to redacting secrets — env values and certificate keys are placeholders, not the real values).

## Resources

| Resource | ID | Notes |
|---|---|---|
| DNS zone | `775662` | `wardrobe-assistants.ch`, bunny nameservers (kiki/coco), DNSSEC off |
| Pull zone (homepage) | `5798479` | `wardrobe-assistants-ch`, origin = storage zone `1498270`, hostnames: `wardrobe-assistants.ch`, `www.wardrobe-assistants.ch`, `wardrobe-assistants-ch.b-cdn.net` (system) |
| Pull zone (admin, MC-managed) | `5798594` | `mc-r6f39iacv2`, auto-created by Magic Container, fronts `admin.wardrobe-assistants.ch` |
| Storage zone | `1498270` | `wardrobe-assistants-ch-homepage`, region `DE` |
| Magic Container app | `h4vme6Uhod4W3Yu` | `wardrobe-assistants-admin`, image `ractive/wardrobe-assistants-admin:8f10eabb…`, region `DE`, autoscale 1/1 |
| Container registry (GitHub Packages) | `5602` | `ghcr.io`, owner `ractive` (per `container-registries.json`) |
| libSQL Database | `db_01KQV95KJ611YYT48VSZKHC495` | name `wa-admin-prod`, group `group_01KKPNWQQ846P1RP4HTN1MWQ1A`, host `01KKPNWQQ846P1RP4HTN1MWQ1A-wa-admin-prod.lite.bunnydb.net`, libSQL `0.24.27`, size 61.4 KB / 1024 MB cap. Captured via `hoppy db {get,versions,statistics,group list}` — see `database-*.json`. Built-in generations: 4 most recent visible, oldest dated 2026-05-05T05:48:31Z (~2h before snapshot run). |
| Edge scripts | — | none |
| Shield zones | — | none configured (both pull zones return "Shield Zone not found") |

## DNS records

(see `dns-zone-775662.bind` for canonical zone file)

- `wardrobe-assistants.ch` → CNAME `wardrobe-assistants-ch.b-cdn.net`
- `www.wardrobe-assistants.ch` → CNAME `wardrobe-assistants-ch.b-cdn.net`
- `admin.wardrobe-assistants.ch` → CNAME `mc-r6f39iacv2.b-cdn.net`
- TXT for Resend / SPF / DMARC: `resend._domainkey`, `send` (SPF), `_dmarc` (`p=none`)
- MX `send` → `feedback-smtp.eu-west-1.amazonses.com` (Resend)

## Files

| File | Description |
|---|---|
| `dns-zone-775662.json` | Full DNS zone with all records |
| `dns-zone-775662.bind` | BIND-format export of the zone |
| `pull-zone-5798479.json` | Homepage pull zone (compact view from `pull-zone get`) |
| `pull-zone-5798479-edge-rules.json` | Empty `[]` |
| `pull-zone-5798594.json` | MC-managed admin pull zone (raw API body — see "Caveats") |
| `pull-zone-5798594-edge-rules.json` | Empty `[]` (per `EdgeRules` field on the pull zone body) |
| `storage-zone-1498270.json` | Storage zone config (passwords redacted) |
| `container-app-h4vme6Uhod4W3Yu.json` | Magic Container app (env values redacted with length only) |
| `container-app-autoscaling.json` | `{min: 1, max: 1}` |
| `container-app-region-settings.json` | DE-only, static provisioning |
| `container-endpoints.json` | Endpoint list (admin-cdn → admin.wardrobe-assistants.ch:3000) |
| `container-volumes.json` | Empty |
| `container-registries.json` | Account-level registries |
| `shield-zone-pullzone-5798479.json` | API error: not found (no shield zone) |
| `shield-zone-pullzone-5798594.json` | API error: not found (no shield zone) |
| `database-db_01KQV95KJ611YYT48VSZKHC495.json` | libSQL DB metadata (name, group, version, size) |
| `database-versions.json` | 4 most recent generation timestamps (built-in `db versions` snapshots, used as DR primitive) |
| `database-statistics.json` | DB usage stats |
| `database-groups.json` | DB groups |
| `database-config-regions.json` | account-wide available regions / compute classes |
| `database-config-limits.json` | account-wide DB limits |

## Caveats

- **`pull-zone-5798594.json` is raw API output**, not hoppy's normalised view. Hoppy fails to deserialise pull zones with `OriginType=5` (Magic Container origin) — `failed to deserialise response body: invalid value: 5, expected one of: 0, 2, 3, 4`. Captured via `--debug` and `grep '<<<'`. Worth filing against hoppy.
- **Env values are length-redacted** per project convention (see memory `redact_bunny_app_envvars`); to inspect actual values run with `--reveal` or `--reveal-env <KEY>` against the live API.
- **Hoppy's compact `pull-zone get`** (zone 5798479) only returns a subset of fields (no edge-rule, optimizer, log-forwarding, etc. settings). For full parity with bunny's API, fetch via `--debug` like 5798594. Also worth filing.
- **`hoppy container app get` is currently broken** — bunny's API returns `protocols: ["tcp"]` (lowercase) but hoppy's enum expects `Tcp`. Error: `unknown variant 'tcp', expected one of 'Tcp', 'Udp', 'Sctp'`. Worked around with `--debug` + `grep '<<<'`. New bug, not previously filed.
- **Database backup primitive: `hoppy db versions` + `hoppy db restore`.** Bunny generates roughly half-hourly internal generations and exposes them via the API; `db versions` lists them and `db restore` rolls back. This is the project's DR mechanism for libSQL — no need for an out-of-band `.dump` script. Auth tokens can be minted with `hoppy db token mint` (so we don't depend on the dashboard for that either).

## Verified against live on 2026-05-07 (re-check)

| Resource | Drift |
|---|---|
| DNS zone `775662` (7 records) | none |
| Pull zone `5798479` (homepage) | none — CacheVersion, EdgeRules, hostnames identical |
| Storage zone `1498270` | none — file count + bytes identical |
| Container app `h4vme6Uhod4W3Yu` | none — env-var **names + lengths**, image tag, autoscale all match |
| Pull zone `5798594` (admin) | none |

The snapshot accurately represents live state for the purposes of IaC import.
