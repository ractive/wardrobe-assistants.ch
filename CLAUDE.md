@AGENTS.md

## Quality gates

Before any commit:

1. `npm run format` — auto-fix formatting (Biome, write).
2. `npm run verify` — `lint && typecheck && test`. Stops at first failure.
3. `npm run verify:tf` — `tofu fmt -check && tofu validate` (only when `infra/terraform/**` changed; requires `tofu init` first).

Read-only snapshot fixtures (`kb/bunny-snapshot-*/**`) and TF (`infra/terraform/**`) are excluded from Biome via `biome.json` — don't loosen the exclusions to "fix" formatter complaints.
