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
