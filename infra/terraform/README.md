# `infra/terraform/`

OpenTofu config for the bunny.net resources behind wardrobe-assistants.ch.
**Apply runs from the developer laptop, not CI.** CI only adds two read-only
signals: a plan comment on every PR (`terraform-plan.yml`) and a daily drift
check (`terraform-drift-check.yml`).

## Quick recipe

```bash
# Per shell session — see runbook for the full backend-config dance.
cd infra/terraform
export TF_VAR_bunny_api_key="$BUNNY_API_KEY"
tofu init -backend-config="$BACKEND_HCL"

tofu plan -lock=false -detailed-exitcode   # 0 clean, 2 drift
tofu apply -lock=false                     # only when intentional
```

`-lock=false` everywhere because bunny's storage API returns 201 on PUT and
OpenTofu's `http` backend wants 200. Single-operator project, so we live with
no locking.

## Where to look

- **Full runbook**, including the per-shell init recipe, import IDs, provider
  quirks, and the CI/CD section: [`kb/runbooks/iac-runbook.md`](../../kb/runbooks/iac-runbook.md).
- **CI workflows**: `.github/workflows/terraform-plan.yml`,
  `.github/workflows/terraform-drift-check.yml`.
