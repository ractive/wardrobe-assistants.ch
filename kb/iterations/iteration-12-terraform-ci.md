---
title: Iteration 12 — Terraform CI (plan on PR, drift-check on cron, apply by hand)
type: iteration
order: 13
status: implemented
related:
  - iteration-11-bunny-iac.md
  - iac-runbook.md
---

# Iteration 12 — Terraform CI (plan on PR, drift-check on cron, apply by hand)

Wire OpenTofu into GitHub Actions for two read-only signals: an automated plan comment on every PR that touches `infra/terraform/**`, and a scheduled drift-check that opens an issue if anyone edits live config out-of-band. **Apply stays on the developer's laptop** — CI never mutates bunny.net resources.

## Context — why "apply by hand" is the right shape today

After iter-11, infra changes happen by editing `.tf`, running `tofu plan` locally to sanity-check, and `tofu apply -lock=false` from the laptop. CI exists to add two signals to that loop:

1. **PR plan comment** — so a reviewer sees the diff without having to clone, init, and plan locally.
2. **Drift-check** — so a dashboard edit doesn't go unnoticed for weeks.

What's deliberately *not* in scope: auto-apply on merge. Two reasons.

- The lock-less HTTP backend (bunny returns 201 on PUT, OpenTofu wants 200, so `-lock=false` everywhere) means two concurrent runs would race the state file. A `concurrency` group at workflow level mitigates within one repo, but the failure mode of "merge button = production change" is sneaky enough that we'd rather keep the apply step manual.
- The mental model "merge = approved for code review, not for deploy" is worth preserving. The merge button approves the diff; running `tofu apply` is the moment of "yes, push this to live." Conflating them adds magic for one developer.

If/when this changes (more contributors, formal change-control), upgrading to a gated `terraform-apply.yml` is a small follow-up — see "Upgrade path" below.

## Pre-flight

- [x] Confirm `BUNNYNET_API_KEY` is in repo secrets (set during iter-9; `deploy.yml` already uses it). Note the naming asymmetry: the **CI secret** is `BUNNYNET_API_KEY`; the **local env var** in `.env.local` is `BUNNY_API_KEY`. Both map onto OpenTofu's `TF_VAR_bunny_api_key`. Don't rename either side without updating both.
- [x] Add `TERRAFORM_STATE_STORAGE_KEY` to repo secrets — the `wardrobe-assistants-terraform-state` storage zone password (zone id `1503083`). Same value already in `.env.local`.
- [x] Pin the OpenTofu version we'll use in CI: `1.11.6` (matches local toolchain at iter-11). Update if a newer version is what people are running.

## Scope — `terraform-plan.yml` (PR comment) [0/5]

Triggers on PRs that touch `infra/terraform/**`. Read-only.

- [x] Create `.github/workflows/terraform-plan.yml`.
  - Trigger: `pull_request` with `paths: ['infra/terraform/**']`.
  - Permissions: `contents: read`, `pull-requests: write`.
  - `concurrency: { group: tofu-state, cancel-in-progress: false }` so two PRs touching infra serialise instead of clobbering.
- [x] Steps:
  1. `actions/checkout@v4`
  2. `opentofu/setup-opentofu@v1` with `tofu_version: 1.11.6`
  3. Write the backend-config HCL from `secrets.TERRAFORM_STATE_STORAGE_KEY` to a temp file (never on the command line — it would echo to logs).
  4. `tofu init -backend-config=/tmp/backend.hcl`
  5. `tofu plan -lock=false -no-color -out=plan.bin` (capture stdout to `plan.txt` for the comment).
  6. Post `plan.txt` as a sticky PR comment via `actions/github-script@v7` (replace the previous bot comment, don't accumulate).
- [x] Cap the inline comment at GitHub's 65 KB limit; if the plan exceeds it, attach the full output as a workflow artefact and post the first ~60 KB inline with a "see workflow artefact" footer.
- [x] Mask sensitive output: `tofu plan` shouldn't print secret values for our config (state already redacts them), but verify with a real plan run before relying on it.
- [ ] Smoke-test on a no-op PR (touch a comment in `dns.tf`) — comment appears within 2 min, exit code 0. Then a real-diff PR (e.g. add an edge rule) — comment shows the diff.

## Scope — `terraform-drift-check.yml` (scheduled) [0/3]

Read-only. Detects out-of-band changes (someone editing live config from the bunny dashboard).

- [x] Create `.github/workflows/terraform-drift-check.yml`.
  - Trigger: `schedule: cron '0 6 * * *'` (06:00 UTC daily) + `workflow_dispatch` for manual runs.
  - Same `concurrency: tofu-state` group as the plan workflow.
- [x] Steps:
  1. Checkout `main`.
  2. Setup OpenTofu, write backend-config, init.
  3. `tofu plan -lock=false -detailed-exitcode -no-color`. Exit code `0` = clean → workflow green. Exit code `2` = drift → workflow red.
  4. On exit `2`: open or update a GitHub issue with the plan output and label `drift`. Use `actions/github-script@v7` to dedupe — one open issue per drift event, comment-append on subsequent runs.
- [ ] Smoke-test by manually flipping a harmless field on the bunny dashboard (e.g. enable logging on a no-traffic field), confirming the drift check fires the next run, then revert.

## Scope — DX, docs [0/3]

- [x] Update `kb/runbooks/iac-runbook.md` "CI/CD" subsection (new):
  - The two workflows, what each one does, what to expect to see.
  - "How to apply" stays the laptop recipe — `git pull main && cd infra/terraform && tofu apply -lock=false`.
  - "How to triage drift" — when the issue fires, decide whether to revert the dashboard change or codify it in `.tf`, and how to do each.
- [x] Add `infra/terraform/README.md` (tiny, ≤30 lines): the local plan/apply recipe, where the runbook lives, and a one-liner pointing at `kb/runbooks/iac-runbook.md`.
- [x] Update `infra/terraform/providers.tf` comment block — point at the runbook for CI specifics.

## Out of scope (deliberate)

- **Auto-apply on merge.** See "Upgrade path" below for when this becomes worth doing.
- **Speculative apply / branch-based plans.** GitHub Actions doesn't natively support speculative plans across branches without state bifurcation. Out of scope.
- **Slack / email notifications.** The repo doesn't currently wire those for any other workflow; a `drift` issue is signal enough for a one-person project.
- **Multi-environment / staging.** Single workspace, no `terraform.workspace` branching.
- **Cost / drift visualisation tooling.** Infracost, terraform-cost-estimation, etc. — not yet a fit.
- **`tflint` / `tfsec` / `tofu test`.** Not yet a real win on this codebase. Add a separate iter when we have ≥30 resources or want CIS-style compliance gates.

## Upgrade path — when to add auto-apply

Trigger to revisit: more than one developer touches infra, or a formal change-control / audit-trail requirement appears.

The upgrade is a small follow-up iter:

1. Add `.github/workflows/terraform-apply.yml`. Trigger on push-to-`main` with `paths: ['infra/terraform/**']`.
2. Run `tofu plan -lock=false -out=plan.bin`, then `environment: production-infra` (a GitHub environment with required reviewer = the deploy approver) — the workflow pauses for a human click.
3. After approval, `tofu apply -lock=false plan.bin` (the saved plan, so what was approved is what runs).
4. Same `concurrency: tofu-state` group as the other workflows.

Estimated effort: half a day. The state-backend, lock semantics, and CI plumbing don't change — only a third workflow file is added. Defer until the trigger fires.

## Critical files

- `.github/workflows/terraform-plan.yml` (new)
- `.github/workflows/terraform-drift-check.yml` (new)
- `infra/terraform/README.md` (new — tiny, just the recipe)
- `kb/runbooks/iac-runbook.md` — append "CI/CD" subsection
- `infra/terraform/providers.tf` — comment update only

## Risks / things that could bite

- **Backend lock false positives in CI.** Bunny's HTTP-201-vs-200 forces `-lock=false`. The `concurrency: tofu-state` group keeps simultaneous workflow runs from racing — but a CI run racing against a manual `tofu apply` from a laptop has no protection. Mitigation: run laptop applies when no PR is open, or pause/cancel the relevant workflow first. Document this in the runbook.
- **Secret exposure in workflow logs.** Never pass secrets on the command line. The temp-file pattern (`echo "headers = { AccessKey = \"$KEY\" }" > /tmp/backend.hcl`) keeps them off the log; double-check by skimming the first PR's run logs after merge.
- **Plan size.** Today's clean plan is empty — comments will be tiny. A real change (security headers iter, edge rules iter) will produce larger comments. The artefact-fallback handles >65 KB but reviewers must remember to download.
- **Drift-check noise.** Bunny's API has fields that fluctuate (cache versions, last-modified timestamps). Iter-11 hand-validated that the current `.tf` matches live without drift; if a future bunny API change introduces a new always-drifting field, the drift-check will go red until we add an `ignore_changes`. Document the triage path in the runbook.
- **Cron timezone.** `cron '0 6 * * *'` is UTC. Adjust if you want it during European working hours.
- **OpenTofu version drift.** CI pinned at `1.11.6`; if you upgrade locally without bumping the workflow, init may behave differently. Add a `tofu version` check at the top of each workflow that fails if it doesn't match a `.tofu-version` file in `infra/terraform/`. (Stretch goal — could be skipped.)

## Done when

- A no-op PR touching `infra/terraform/dns.tf` produces a plan comment within 2 min.
- A real-diff PR (e.g. add an edge rule) produces a comment showing the actual diff. Merging it does **not** trigger any apply — the laptop apply step happens manually.
- The drift-check workflow has run on schedule at least once with exit code 0.
- A manually injected drift (one harmless field flipped via bunny dashboard) triggers a `drift`-labelled issue with the diff inside.
- The runbook explains: how to read the PR comment, how to apply locally after merge, what to do when the drift-check fires.
