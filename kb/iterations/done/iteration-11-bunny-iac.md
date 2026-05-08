---
title: Iteration 11 — bunny.net infra as code (OpenTofu + bunnynet)
type: iteration
order: 12
status: done
related: [iac-runbook.md, bunny-snapshot-2026-05-07/SUMMARY.md, iteration-09-go-live-bunny-infra.md, hoppy-usage-report.md]
---

# Iteration 11 — bunny.net infra as code (OpenTofu + bunnynet)

Move every live bunny.net resource backing wardrobe-assistants.ch out of dashboard / one-off `hoppy` commands and into version-controlled OpenTofu configuration. The 2026-05-07 snapshot was the import target; once iter-11 closed, `tofu plan -detailed-exitcode` returns `0` against live.

## Context — why now

After iter-9 went live, the only durable infra artefact was `kb/runbook-go-live.md` — a chronological cutover log. That's enough to ship once. It is not enough to:

- Recover from accidental dashboard edits or deletion (the snapshot from 2026-05-07 confirmed we can describe state but couldn't replay it cleanly without reading-and-typing).
- Stand up a staging mirror.
- Review infra changes in a PR with a diff a human can read.
- Guarantee that future iterations (security headers, log forwarding, edge rules) don't drift.

A pure-script plan was rejected once the [`BunnyWay/bunnynet`](https://registry.terraform.io/providers/BunnyWay/bunnynet/latest) provider was inspected — it covers Magic Containers (`bunnynet_compute_container_app`), image registries (`bunnynet_compute_container_imageregistry`), and the libSQL database (`bunnynet_database`) at first-class quality. Stova.ch was already running the same provider against a comparable setup; that runbook (`/Users/james/devel/comparis/stova.ch/stova-knowledgebase/infrastructure/iac-runbook.md`) was the working template.

## Pre-flight [3/3]

- [x] Read stova.ch's `iac-runbook.md` and the four `.tf` files referenced. Confirmed the bunnynet provider has the coverage we need.
- [x] Verify `BUNNY_API_KEY` exported, `hoppy auth check` green.
- [x] Verify the snapshot in `kb/bunny-snapshot-2026-05-07/` is drift-free vs live (DNS, pull zones, storage, container app + sub-resources). Drift check appended to `SUMMARY.md`.

## State backend [4/4]

User chose option B (bunny storage backend from day one) over A→B (start local, migrate later).

- [x] Create state storage zone via `hoppy storage-zone create --name wardrobe-assistants-terraform-state --region DE --zone-tier 0` → id `1503083`.
- [x] Capture the storage-zone password into `.env.local` as `TERRAFORM_STATE_STORAGE_KEY` (gitignored).
- [x] Configure the OpenTofu HTTP backend in `providers.tf` pointing at `https://storage.bunnycdn.com/wardrobe-assistants-terraform-state/wardrobe-assistants.ch/terraform.tfstate`.
- [x] Document the bunny-201-vs-200 lock mismatch — every command runs with `-lock=false` (single-operator project, safe).

## Scope — write `.tf` to match live, then import [9/9]

- [x] `infra/terraform/providers.tf` — `required_version >= 1.9`, `bunnynet ~> 0.13` (resolves to 0.14.0), HTTP backend block.
- [x] `infra/terraform/variables.tf` — `bunny_api_key` (sensitive) + every resource id as a defaulted variable.
- [x] `infra/terraform/dns.tf` — DNS zone + 7 records, with `ignore_changes = all` on the four Resend-managed records (DKIM, SPF, MX, DMARC).
- [x] `infra/terraform/storage.tf` — homepage + state storage zones, `prevent_destroy = true` on both.
- [x] `infra/terraform/pullzones.tf` — homepage + admin pull zones, three hostnames; `cache_chunked = true` and `cache_expiration_time = 2592000` set explicitly to match live; admin pull zone has `ignore_changes = [origin]`.
- [x] `infra/terraform/containers.tf` — image registry + admin container app; `ignore_changes = [container]` keeps env-var values and image tag out of state; image registry has `ignore_changes = [token, registry]`.
- [x] `infra/terraform/database.tf` — `wa-admin-prod`, `prevent_destroy = true`. Auth tokens stay outside (managed via `hoppy db token mint`).
- [x] `infra/terraform/outputs.tf` — DNS zone id, CDN hostnames, storage endpoint, container app id, DB URL.
- [x] `infra/terraform/imports.tf` — one `import {}` block per resource (used for the first apply, deleted afterwards).

## Scope — clean plan, then apply [4/4]

- [x] `tofu init -backend-config=<temp HCL with storage zone AccessKey>` — backend connects, provider 0.14.0 installed.
- [x] `tofu plan -lock=false` — looped on it, fixing two real config drifts on the homepage pull zone (`cache_chunked`, `cache_expiration_time`) and validation gymnastics on the admin pull zone (`container_endpoint_id` is required at config-validation time even with `ignore_changes = [origin]`). Final plan: **18 to import, 0 to add, 0 to change, 0 to destroy.**
- [x] `tofu apply -lock=false` — 18 imports, zero live mutations, applied 2026-05-07.
- [x] Re-plan — `tofu plan -lock=false -detailed-exitcode` exit code 0. Steady state.

## Deliverables [3/3]

- [x] `infra/terraform/` — eight `.tf` files (no `imports.tf`, deleted post-apply).
- [x] `kb/iac-runbook.md` — operations guide; ported from stova.ch with our IDs, our quirks, our import order.
- [x] `kb/hoppy-usage-report.md` — appended an iter-11 follow-up section recording new bugs (lowercase `tcp` enum on `container app get`, `--debug` bypassing redaction), gaps re-confirmed, and the ✅ for the new `db` subcommand.

## Out of scope (held for follow-ups)

- **CI drift-check workflow.** A scheduled `tofu plan -detailed-exitcode` against `main` would catch dashboard edits. Holding for the next iter — needs `BUNNYNET_API_KEY` + `TERRAFORM_STATE_STORAGE_KEY` available to the workflow runner. Read-only, never `apply` from CI.
- **Secret rotation.** During this iteration, `--debug` and `--reveal` operations leaked `BETTER_AUTH_SECRET`, `DATABASE_AUTH_TOKEN`, `RESEND_API_KEY`, and the new `TERRAFORM_STATE_STORAGE_KEY` into the conversation transcript. Tracked separately — rotate via `hoppy db token mint` (DB token), `openssl rand -base64 32` (Better Auth), Resend dashboard (API key), bunny dashboard (storage zone password).
- **Edge rules / shield zones / WAF.** None configured today; will land in a security-headers iteration. The provider supports them as `bunnynet_pullzone_edgerule` etc., so it'll slot in.
- **Multi-environment (staging).** Single workspace, no `terraform.workspace` branching. Layout will accommodate a staging clone when needed.
- **Database backups beyond bunny generations.** `hoppy db versions` exposes ~half-hourly auto-snapshots. For belt-and-suspenders, an external libSQL `.dump` script is a future task.

## Critical files

- `infra/terraform/*.tf` — eight files
- `kb/iac-runbook.md` — operations guide
- `kb/hoppy-usage-report.md` — appended iter-11 section
- `.gitignore` — added `infra/terraform/.terraform/`, `*.tfstate`, `*.tfvars`, `crash.log`, `generated.tf`
- `kb/bunny-snapshot-2026-05-07/` — reference; not modified

## Risks / things that bit during the iteration (and how)

- **`tofu plan -generate-config-out` leaks secrets.** The bunnynet provider serialises every `env { name value }` block into the generated config — including secret values. Mitigation: deleted the generated file before any commit and added it to `.gitignore` so accidental commits get blocked. Worth filing upstream — the provider could mark `env.*.value` write-only.
- **HTTP-201 lock acquisition mismatch.** OpenTofu's `http` backend expects HTTP 200 from the lock URL; bunny Storage returns 201 for all PUTs. Workaround: `-lock=false` everywhere. Stova hit the same and accepted it. Single-operator = safe.
- **Provider re-validates auto-generated config.** `cache_expiration_time` "must be 31919000 or omitted", `latency_zone` "must be at least 1", etc. — the generator emits "0/empty" for fields the API returned that way, but the provider then refuses to validate them. Mitigation: hand-write the `.tf` and rely on `ignore_changes` plus explicit values for fields the provider cares about.
- **Provider 0.14 dropped silent acceptance of empty `container_endpoint_id`.** Even with `ignore_changes = [origin]`, the validator demands a non-empty value at parse time. Pasted the live id (`h4vme6Uhod4W3Yu-admin-cdn-SBfPZ5UIiZ`) into the .tf — `ignore_changes` makes drift on it harmless going forward.
- **Hoppy `--debug` body output bypasses redaction.** When falling back to `--debug` to recover from upstream bugs, the unredacted JSON body lands in stdout. Filed under iter-11 follow-up in `hoppy-usage-report.md` as the highest-priority hoppy fix.

## Done when

- ✅ `tofu plan -lock=false -detailed-exitcode` returns `0` (no drift) — verified 2026-05-07.
- ✅ `infra/terraform/` is the source of truth for what bunny.net should look like.
- ✅ `kb/iac-runbook.md` is enough for someone fresh to bootstrap, plan, and apply.
- ✅ Hoppy feedback recorded — two new bugs, five gaps re-confirmed, plus the `db` subcommand win.
