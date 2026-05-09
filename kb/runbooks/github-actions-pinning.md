---
title: GitHub Actions Pinning Convention
type: runbook
status: active
tags: [github-actions, supply-chain, security, runbook]
created: 2026-05-09
related: [iteration-16b-edge-hardening.md, iac-runbook.md]
---

# GitHub Actions Pinning Convention

iter-16b (audit C-SEC-03) introduced a per-Action pinning posture for `.github/workflows/`. The choice between **SHA-pinning** and **tag-pinning** is intentional — over-applying SHA pins to first-party Actions adds maintenance friction with no security gain, while under-applying them to third-party Actions leaves the deploy pipeline open to upstream takeover.

## The rule

| Source | Pin to | Why |
|---|---|---|
| `BunnyWay/*` and any other third-party org | **Commit SHA** | A compromised maintainer account on a third-party org can rewrite a `@main` or `@v1` tag and ship arbitrary code into our deploy. SHAs are immutable. |
| `actions/*` (GitHub-owned) | **Tag** (`@v4` style) | Maintained by GitHub itself; tag updates are signed and audited. SHA-pinning these would mean chasing patch releases by hand, with no marginal security gain. |
| `docker/*` (Docker, Inc.) | **Tag** (`@v3`, `@v6` style) | Docker-owned, same trust posture as `actions/*`. |

If a new third-party Action enters a workflow, it gets a SHA pin. If it's a first-party Action from one of the trusted orgs above, a tag pin is fine.

## Pinning a new third-party Action

```bash
# Resolve the SHA matching the current branch head:
git ls-remote https://github.com/<owner>/<repo>.git refs/heads/main

# Or, for a release tag:
git ls-remote https://github.com/<owner>/<repo>.git refs/tags/v1.2.3
```

Then in the workflow:

```yaml
- uses: BunnyWay/actions/container-update-image@<40-char-sha>
  # SHA: BunnyWay/actions @ <sha>
  # (refs/heads/main as of YYYY-MM-DD).
```

The trailing comment is mandatory — it lets the next person bumping the pin see what version the SHA corresponded to without re-running `git ls-remote`.

## Bumping an existing SHA pin

1. Re-run `git ls-remote` against the same source.
2. Skim the upstream changelog / commit log between the old and new SHAs. Look for: build-script changes, new env reads, new network egress, new permission requirements.
3. Bump the SHA + update the comment with the new resolved date.
4. Land in a PR; tag with `supply-chain` so the change is reviewable independently of feature work.

## Audit cue

`grep -nR '@main\|@master' .github/workflows/` should return **no third-party uses**. Any `@main` reference to a non-`actions/*`/`docker/*` Action is a regression of this policy.

## See also

- [iteration-16b-edge-hardening.md](../iterations/iteration-16b-edge-hardening.md) — introduced this convention.
- [iac-runbook.md](iac-runbook.md) — sibling runbook for the OpenTofu side of the deploy pipeline.
