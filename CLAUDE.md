# General
Use agents for implementation tasks whenever possible.

# bunny.net services
If you manage bunny.net services, use the "hoppy" CLI tool (hoppy --help) to discover and debug things.

# Browser debugging
If you need to debug something in the browser, use the ff-rdp CLI tool (ff-rdp --help) in favor of the chrome mcp server. Collect feedback about ff-rdp in the kb knowledgebase.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Quality gates

Before any commit:

1. `npm run format` — auto-fix formatting (Biome, write).
2. `npm run verify` — `lint && typecheck && test`. Stops at first failure.
3. `npm run verify:tf` — `tofu fmt -check && tofu validate` (only when `infra/terraform/**` changed; requires `tofu init` first).

Read-only snapshot fixtures (`kb/bunny-snapshot-*/**`) and TF (`infra/terraform/**`) are excluded from Biome via `biome.json` — don't loosen the exclusions to "fix" formatter complaints.
