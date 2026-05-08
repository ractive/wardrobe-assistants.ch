---
title: IaC Runbook — OpenTofu + bunnynet on wardrobe-assistants.ch
type: runbook
status: active
tags: [opentofu, terraform, iac, bunny, runbook]
created: 2026-05-07
related: [iteration-11-bunny-iac.md, iteration-12-terraform-ci.md, bunny-snapshot-2026-05-07/SUMMARY.md, hoppy-usage-report.md, runbook-go-live.md]
---

# IaC Runbook — OpenTofu + bunnynet provider

Day-to-day operations for the wardrobe-assistants.ch infrastructure managed via OpenTofu and the `BunnyWay/bunnynet` provider. All `.tf` files live in `infra/terraform/`.

**Current status (as of 2026-05-07):** All 18 live resources are imported and under state management. Remote state backend is active. `tofu plan -detailed-exitcode` returns exit code 0 — no drift.

For the original migration plan and rationale see `kb/iteration-11-bunny-iac.md`.

---

## Prerequisites

```bash
brew install opentofu
tofu version   # 1.9 or later
```

Required env vars in `.env.local` (gitignored):

| Env var | Purpose |
|---|---|
| `BUNNY_API_KEY` | Bunny account API key — exported as `TF_VAR_bunny_api_key` |
| `TERRAFORM_STATE_STORAGE_KEY` | Storage zone password for `wardrobe-assistants-terraform-state` (zone id `1503083`); used as the `AccessKey` HTTP header against bunny's storage API |

---

## Directory layout

```
infra/terraform/
  providers.tf               # required_providers + provider "bunnynet" + http backend
  variables.tf               # all input variables (bunny_api_key marked sensitive)
  outputs.tf                 # CDN hostnames, storage endpoints, container app id, DB URL
  dns.tf                     # bunnynet_dns_zone + 7 records (4 Resend-managed = ignore_changes)
  storage.tf                 # bunnynet_storage_zone × 2 (homepage, terraform_state)
  pullzones.tf               # bunnynet_pullzone × 2 + 3 hostnames
  containers.tf              # bunnynet_compute_container_app + image registry
  database.tf                # bunnynet_database wa-admin-prod
```

---

## Day-to-day operations

### Step 1 — Build the backend-config file (per shell session)

The `http` backend needs the storage-zone password as an HTTP header. HCL needs the value double-quoted, so use `jq -Rs`:

```bash
TFSTATE_KEY=$(grep '^TERRAFORM_STATE_STORAGE_KEY=' .env.local | cut -d= -f2-)
BACKEND_HCL=$(mktemp)
trap 'rm -f "$BACKEND_HCL"' EXIT
QUOTED=$(printf '%s' "$TFSTATE_KEY" | jq -Rs '.')
printf 'headers = { AccessKey = %s }\n' "$QUOTED" > "$BACKEND_HCL"
```

### Step 2 — Init (after clone, or after backend/provider changes)

```bash
cd infra/terraform
export TF_VAR_bunny_api_key="$BUNNY_API_KEY"
tofu init -backend-config="$BACKEND_HCL"
```

### Step 3 — Plan

```bash
tofu plan -lock=false -detailed-exitcode
# 0 = no changes (the steady state)
# 2 = changes detected (review and either fix .tf to match live, or apply)
```

### Apply

```bash
tofu apply -lock=false
```

**Golden rule:** if `plan` shows changes you didn't intend, fix the `.tf` to match live. Don't apply over the top.

### Format / validate

```bash
tofu fmt
tofu validate
```

---

## CI/CD

CI is **read-only**. Two GitHub Actions workflows live at
`.github/workflows/terraform-plan.yml` and
`.github/workflows/terraform-drift-check.yml`. Neither one ever runs `tofu
apply` — that step stays manual on the laptop.

### Why apply isn't automated

- The `http` backend runs `-lock=false` (bunny PUT returns 201, OpenTofu wants
  200). Two concurrent applies would race the state file. CI workflows share a
  `concurrency: tofu-state` group to serialise themselves, but a CI run racing
  a laptop apply has no protection — keeping apply manual makes the conflict
  obvious.
- "Merge approves the diff; running `tofu apply` is the moment of pushing it
  live" is a clearer mental model than "merge button = production change."

### Required GitHub secrets

| Secret | Mirror of `.env.local` var | Purpose |
|---|---|---|
| `BUNNYNET_API_KEY` | `BUNNY_API_KEY` | Bunny account API key — exposed to OpenTofu as `TF_VAR_bunny_api_key`. Already used by `deploy.yml`. |
| `TERRAFORM_STATE_STORAGE_KEY` | same name | Storage-zone password for `wardrobe-assistants-terraform-state` — written into a temp backend-config file inside the runner, never to the command line. |

The naming asymmetry on the API key is intentional but easy to miss. Don't
rename either side without updating both.

### `terraform-plan.yml` — PR plan comment

- **Trigger:** `pull_request` touching `infra/terraform/**` (or the workflow
  itself).
- **What it does:** init against the live state, `tofu plan -lock=false`, post
  the output as a sticky PR comment (one comment per PR — re-runs replace, not
  append).
- **Plan size:** GitHub caps issue comments at 65 KB. The script keeps the
  inline comment to ~60 KB and uploads the full `plan.txt` as the `tofu-plan`
  workflow artefact (14-day retention) for download when the diff is large.
  The binary plan (`-out=plan.bin`) is deliberately *not* generated in CI:
  binary plans can embed `TF_VAR_*` values, and we never apply from CI.
- **What to look for as a reviewer:** the diff lines under the `### OpenTofu
  plan` heading. If only `ignore_changes`-covered fields show up, something is
  wrong — paste them in the PR thread. If the comment says *failed*, click
  through to the workflow log.

### `terraform-drift-check.yml` — daily out-of-band check

- **Trigger:** `schedule: '0 6 * * *'` (06:00 UTC daily) plus
  `workflow_dispatch` for manual runs.
- **What it does:** init against `main`, `tofu plan -lock=false
  -detailed-exitcode`. Exit code `2` = drift → opens or appends to a `drift`-
  labelled issue and fails the run. Exit `0` = clean.
- **Triage when the issue fires:**
  1. Open the issue, read the diff.
  2. Decide: is the live change *intentional* (someone tweaking a dashboard
     during an outage, an emergency edge rule), or *accidental*?
  3. **Intentional** → codify it in `infra/terraform/`, open a PR, watch the
     PR plan comment go to a no-op, merge, close the drift issue.
  4. **Accidental** → revert the live config (dashboard or API), let the next
     drift run go green, close the drift issue.
  5. **Persistent / always-drifting field** (a new bunny API field that
     fluctuates): add `ignore_changes = [<field>]` on the resource, document
     the reason in the "Provider quirks" section above.

### What "apply" looks like after merging an infra PR

CI does not apply. The recipe is the same as before:

```bash
git checkout main && git pull
cd infra/terraform
# Build $BACKEND_HCL per "Step 1" above.
export TF_VAR_bunny_api_key="$BUNNY_API_KEY"
tofu init -backend-config="$BACKEND_HCL"
tofu plan  -lock=false        # sanity check — should match the PR comment
tofu apply -lock=false
```

If a workflow run is in flight (check the Actions tab), wait for it to finish
or cancel it before running apply — they share the same state file with no
locking.

### OpenTofu version

CI is pinned to **`1.11.6`** in both workflow files. If you upgrade locally,
bump both workflows in the same PR — the PR plan comment is your sanity check.

### Upgrade path — when to add auto-apply

When more than one developer touches infra, or a formal change-control / audit
trail is needed, add `terraform-apply.yml`:

1. `push` to `main` with `paths: ['infra/terraform/**']`.
2. `tofu plan -lock=false -out=plan.bin`, then `environment:
   production-infra` (a GitHub Environment with required reviewer) so the
   workflow pauses for a human click.
3. `tofu apply -lock=false plan.bin` after approval.
4. Same `concurrency: tofu-state` group.

Half-day of work, no state-backend changes — defer until the trigger fires.

---

## Remote state backend

| Field | Value |
|---|---|
| Backend type | `http` (bunny has no S3-compatible API) |
| State URL | `https://storage.bunnycdn.com/wardrobe-assistants-terraform-state/wardrobe-assistants.ch/terraform.tfstate` |
| Storage zone id | `1503083` |
| Region | `DE` |
| Auth | `AccessKey` HTTP header → `TERRAFORM_STATE_STORAGE_KEY` |

**Why `http` not `s3`:** bunny Storage doesn't expose an S3-compatible API endpoint. The `s3` backend fails with `"S3 API is not enabled for this storage zone"`. `http` uses plain GET/PUT/DELETE which maps directly onto bunny's REST storage API.

**Why `-lock=false`:** OpenTofu's `http` backend sends a PUT to the lock URL and expects HTTP 200; bunny Storage returns 201 for all successful PUTs. This mismatch breaks lock acquisition. Single-operator project = safe to skip locking. (A stale `terraform.tfstate.lock` file may sit in the storage zone — harmless.)

### State lost? Re-import from scratch

If state is ever lost, re-run all `tofu import` commands in the section below. Every resource id is documented.

---

## Re-importing resources (disaster recovery)

Import in dependency order. After every group, run `tofu plan -lock=false` and confirm clean (or fix `.tf` and retry).

**Import id formats** (provider-specific — copied from stova's runbook):
- DNS records: `"<zoneId>|<recordId>"` — e.g. `'775662|16538536'`
- Pull zone hostnames: `"<pullzoneId>|<hostname>"` — e.g. `'5798479|wardrobe-assistants.ch'`
- Everything else: plain numeric or string id

### 1 — DNS

```bash
tofu import bunnynet_dns_zone.wardrobe_assistants_ch 775662
tofu import 'bunnynet_dns_record.apex_cname'      '775662|16538536'
tofu import 'bunnynet_dns_record.www_cname'       '775662|16538537'
tofu import 'bunnynet_dns_record.admin_cname'     '775662|17031761'
tofu import 'bunnynet_dns_record.dmarc_txt'       '775662|17098161'
tofu import 'bunnynet_dns_record.resend_dkim_txt' '775662|17098158'
tofu import 'bunnynet_dns_record.send_spf_txt'    '775662|17098160'
tofu import 'bunnynet_dns_record.send_mx'         '775662|17098159'
```

### 2 — Storage zones

```bash
tofu import bunnynet_storage_zone.homepage        1498270
tofu import bunnynet_storage_zone.terraform_state 1503083
```

### 3 — Pull zones + hostnames

```bash
tofu import bunnynet_pullzone.homepage  5798479
tofu import bunnynet_pullzone.admin_cdn 5798594
tofu import 'bunnynet_pullzone_hostname.homepage_apex' '5798479|wardrobe-assistants.ch'
tofu import 'bunnynet_pullzone_hostname.homepage_www'  '5798479|www.wardrobe-assistants.ch'
tofu import 'bunnynet_pullzone_hostname.admin_cdn'     '5798594|admin.wardrobe-assistants.ch'
```

### 4 — Container registry + app

```bash
tofu import bunnynet_compute_container_imageregistry.ghcr_ractive 5602
tofu import bunnynet_compute_container_app.admin                  h4vme6Uhod4W3Yu
```

### 5 — Database

```bash
tofu import bunnynet_database.wa_admin_prod db_01KQV95KJ611YYT48VSZKHC495
```

---

## Provider quirks and workarounds

### DNS root record: `name = ""` not `name = "@"`
The provider stores the apex record name as an empty string. `name = "@"` triggers a replacement.

### DNS record import format: `"zoneId|recordId"`
Plain record IDs do not work — use the composite key.

### Pull zone hostname import format: `"pullzoneId|hostname"`
Use `|` not `/` as the separator.

### Magic-Container pull zone: explicit `cache_enabled = true`, `strip_cookies = false`
Live values diverge from the provider's defaults. Set them explicitly to avoid drift noise.

### Magic-Container pull zone: `ignore_changes = [origin]`
The MC controller rotates `container_endpoint_id` on every container redeploy. Without `ignore_changes` every redeploy creates drift.

### Container registry: `ignore_changes = [token, registry]`
- `registry` schema accepts `"GitHub"`; bunny API returns `"GitHub Packages ractive"`. Without ignore, force-replace.
- `token` is a write-only secret.

### Container app: `ignore_changes = [container]`
The whole inner block is owned by the deploy pipeline (env vars, image tag). OpenTofu tracks the app's identity (name, regions, autoscaling) but never reads or writes the container contents.

### Container app: `regions_max_allowed = 1` must be explicit
Provider defaults to 0 on import.

### Database auth tokens: not OpenTofu-manageable
Bunny doesn't expose a token-generation API in a way the provider can consume. Use `hoppy db token mint --id <db-id>` (CLI) or the dashboard. Token is injected via container env vars (managed by the deploy pipeline, not OpenTofu).

### Resend-managed DNS records: `ignore_changes = all`
DKIM, SPF, MX, DMARC are owned by Resend. Imported for visibility; OpenTofu never modifies them.

### Generated config (`tofu plan -generate-config-out`) leaks env-var values
The provider includes `env { name=… value=… }` blocks in the generated `.tf`. **Delete the generated file before commit** if it's been against the live container app. Our `.gitignore` blocks `infra/terraform/generated.tf` to make this harder to mis-commit.

### Provider is pre-1.0
Pin tightly (`~> 0.14` currently). Don't auto-merge dependabot bumps — review changelog first, especially for schema changes.

---

## Database backup / DR

Bunny generates ~half-hourly DB snapshots automatically; surface and restore via `hoppy db`:

```bash
hoppy db versions --id db_01KQV95KJ611YYT48VSZKHC495 --limit 20   # list available generations
hoppy db restore  --id db_01KQV95KJ611YYT48VSZKHC495 --generation <uuid>   # destructive
hoppy db token mint --id db_01KQV95KJ611YYT48VSZKHC495             # mint a fresh auth token
```

This is the project's primary DR primitive — no external `.dump` script needed.

---

## Resource ID reference

| Resource | TF address | bunny ID |
|---|---|---|
| DNS Zone | `bunnynet_dns_zone.wardrobe_assistants_ch` | `775662` |
| CNAME apex | `bunnynet_dns_record.apex_cname` | `16538536` |
| CNAME www | `bunnynet_dns_record.www_cname` | `16538537` |
| CNAME admin | `bunnynet_dns_record.admin_cname` | `17031761` |
| TXT _dmarc | `bunnynet_dns_record.dmarc_txt` | `17098161` |
| TXT resend._domainkey (DKIM) | `bunnynet_dns_record.resend_dkim_txt` | `17098158` |
| TXT send (SPF) | `bunnynet_dns_record.send_spf_txt` | `17098160` |
| MX send | `bunnynet_dns_record.send_mx` | `17098159` |
| Storage zone homepage | `bunnynet_storage_zone.homepage` | `1498270` |
| Storage zone state | `bunnynet_storage_zone.terraform_state` | `1503083` |
| Pull zone homepage | `bunnynet_pullzone.homepage` | `5798479` |
| Pull zone admin CDN | `bunnynet_pullzone.admin_cdn` | `5798594` |
| Hostname `wardrobe-assistants.ch` | `bunnynet_pullzone_hostname.homepage_apex` | — |
| Hostname `www.wardrobe-assistants.ch` | `bunnynet_pullzone_hostname.homepage_www` | — |
| Hostname `admin.wardrobe-assistants.ch` | `bunnynet_pullzone_hostname.admin_cdn` | — |
| Container registry GHCR | `bunnynet_compute_container_imageregistry.ghcr_ractive` | `5602` |
| Container app admin | `bunnynet_compute_container_app.admin` | `h4vme6Uhod4W3Yu` |
| Database wa-admin-prod | `bunnynet_database.wa_admin_prod` | `db_01KQV95KJ611YYT48VSZKHC495` |

---

## Migration history

| Date | Event |
|---|---|
| 2026-05-07 | Snapshot of all live resources captured at `kb/bunny-snapshot-2026-05-07/`. |
| 2026-05-07 | `wardrobe-assistants-terraform-state` storage zone (id `1503083`) created via `hoppy`. |
| 2026-05-07 | All 18 resources imported via `tofu apply` after a clean plan. `tofu plan -detailed-exitcode` = 0. |

---

## What's deliberately *not* in OpenTofu

- **Edge scripts, shield zones** — none configured today; will land via dedicated iterations when needed.
- **Secret values** — env vars on the admin app, image registry token, storage-zone passwords. All flow through `.env.local` / GitHub Actions secrets / dashboard, never state.
- **DB auth tokens** — minted via `hoppy db token mint`, not via the provider.
- **DB schema / migrations** — Drizzle migrations in `packages/db`, run by the admin runtime on boot.
- **Storage zone *contents*** — the homepage build is uploaded by the deploy workflow.
- **Image build/push** — built and pushed by GitHub Actions; the container app's `ignore_changes = [container]` keeps OpenTofu out of image-tag rotation.
