---
title: >-
  Iteration 41 — Decouple admin static assets from app server (assetPrefix +
  storage zone)
type: iteration
order: 42
status: done
---

# Iteration 41 — Decouple admin static assets from app server

## Motivation

The admin app's `_next/static/` chunks are served through the same pull zone as the dynamic app (`admin_cdn`, id 5798594), with the Magic Container as origin. During a container rolling deploy there is a window in which an edge can request a chunk URL emitted by the *new* HTML from an *old* container instance (or vice-versa). The old instance has no such chunk on disk and returns a `404 text/plain "File not found"`. With `X-Content-Type-Options: nosniff` set, browsers refuse to execute it (`NS_ERROR_CORRUPTED_CONTENT` / "MIME type mismatch"). Worse, the chunk URL is marked `Cache-Control: public, max-age=31536000, immutable`, so bunny pins that 404 at the edge until manually purged.

Symptoms (observed 2026-05-13 on `/my-bookings/<id>`):

- "Something went wrong" Next.js error boundary after a normal reload.
- Browser console: `ChunkLoadError: Failed to load chunk /_next/static/chunks/<hash>.js`.
- Manual `hoppy pull-zone purge` restored the site.

Rejected alternative fixes:

- **Purge the pull zone after each deploy.** Doesn't work: old + new containers serve concurrently during rollover, so a post-purge request can immediately refill the cache with stale 404s before the rollover completes.
- **`generateBuildId`.** Chunk filenames are already content-hashed; the failure isn't collision but missing-on-origin. A deterministic `BUILD_ID` *would* be required if the pipeline built twice and needed to reconcile two `BUILD_ID`s — but our pipeline builds once and extracts the static dir from the same image (see §B), so `BUILD_ID` parity is automatic. No `generateBuildId` config needed.
- **Disable 404 caching at the edge.** Reduces failure mode from "permanent until purge" to "self-heals in ~30-60s", but users actively reloading during a rollover still see error boundaries. Worth doing as defense in depth, but not the structural fix.

The structural fix is the standard Next.js pattern: serve `_next/static/` from a CDN-backed object store, upload chunks *before* rolling the container, never delete old chunks. Both old and new container instances can then reference their own chunk paths through the CDN with zero overlap and zero rollover races.

## Open questions to resolve before scoping

- **Hostname strategy.** Custom hostname (`admin-static.wardrobe-assistants.ch`) vs raw bunny pull-zone host (`<zone>.b-cdn.net`)? Custom hostname is the long-term answer but needs a DNS entry + TLS cert provisioning; b-cdn.net is one less moving part. Default to b-cdn.net for v1, custom hostname queued for a later iteration if useful.
- **Reuse the existing admin pull zone (with a path-prefix routing rule) vs provision a new dedicated pull zone?** Dedicated zone is cleaner (different caching posture, different origin type) and matches how `homepage` is structured. Default to a dedicated zone.
- **CSP impact.** The admin sends `script-src 'self' 'nonce-…' 'strict-dynamic'` from `src/proxy.ts`. `strict-dynamic` propagates trust from the nonced bootstrap script to scripts it loads, regardless of origin — so in theory no CSP change is needed. To be verified end-to-end in dev with `connect-src` left as `'self'` (dynamic imports may still fetch via the network — confirm with a browser console check on a real route).
- **`public/` files.** `assetPrefix` only rewrites `_next/static/` URLs, not files served from `public/`. `/sw.js`, `/icon-*.png`, `/badge-72.png`, `/manifest.webmanifest` (if present) stay on the app origin. That's the desired behaviour for `/sw.js` because of the `Service-Worker-Allowed: /` scope, and is unaffected for the rest. Confirm during smoke.
- **Cleanup of old chunks.** Once we stop deleting on each upload, the storage zone grows indefinitely. Acceptable for v1 (content-hashed chunks are tiny; admin is low-volume); queue a TTL cleanup as a follow-up.
- **Local dev.** `npm run dev:admin` should not use `assetPrefix` — chunks are served by the Next dev server on localhost. Gate the config on `process.env.ADMIN_ASSET_PREFIX`.

## Scope

### A. Infrastructure (Terraform)

1. New `bunnynet_storage_zone.admin_static` (region `DE`, Standard tier, `prevent_destroy = true`).
2. New `bunnynet_pullzone.admin_static` with `cache_enabled = true`, origin = storage zone, generous expiration (≥30 days; immutable assets are safe). `strip_cookies = true` (no auth flow touches this hostname).
3. Output the pull-zone hostname so the deploy step can reference it.

### B. Deploy pipeline (`.github/workflows/deploy.yml`)

**Single build.** `next build` already runs inside the Docker build; we extract `_next/static/` from the just-built image rather than rebuilding on the host.

In `build-admin`, the new step order is:

1. Docker build + push (existing).
2. Trivy scan (existing).
3. **New** — extract `_next/static/` from the image:
   ```yaml
   - name: Extract _next/static from admin image
     if: steps.changes.outputs.app == 'true'
     run: |
       cid=$(docker create ghcr.io/${{ github.repository_owner }}/wardrobe-assistants-admin:${{ github.sha }})
       docker cp "$cid:/app/apps/admin/.next/static" ./admin-static
       docker rm "$cid"
   ```
4. **New** — upload to bunny storage with `ayeressian/bunnycdn-storage-deploy@v2.4.5`, using **`upload: "true"`, `remove: "false"`** (additive — never delete; old container instances may still reference their chunks during rollover). *No `purgePullZone`* — chunks are immutable and content-hashed; nothing to invalidate.
5. Container roll (existing, must run *after* upload).

Alternative considered: a `target: static-export` `FROM scratch` stage in the Dockerfile + a second `docker buildx build --target static-export --output type=local,dest=./admin-static` invocation. With buildx layer cache, the second invocation hits the cache and doesn't re-run `next build`. Cleaner separation, but requires a remote buildx cache (`cache-to: type=gha`) to be reliable on ephemeral runners.

**The `docker create` + `docker cp` approach is the de-facto industry standard** for this exact problem (Next.js standalone + CDN-decoupled static assets in a containerised deploy). It preserves a single `next build` invocation and a matching `BUILD_ID` between image and CDN. Rejected alternatives:

- **Build `next build` twice** (once on host for upload, once in Docker for image) — universally rejected because `BUILD_ID` parity breaks. The container and the CDN would reference different chunk paths.
- **Build on host then `COPY` into image** (Vercel's own time-saving recommendation in their self-host docs) — viable but requires the host toolchain to match the runtime image and is hermetically less clean. Keep as a fallback if image extraction becomes painful.

References: `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`, `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/assetPrefix.md`, vercel/next.js discussions #47553, #73469, #80047.

New secrets:
- `BUNNY_ADMIN_STATIC_STORAGE_ZONE_NAME`
- `BUNNY_ADMIN_STATIC_STORAGE_PASSWORD`

### C. Application config

1. `apps/admin/next.config.ts`: read `process.env.ADMIN_ASSET_PREFIX` and set `assetPrefix` when defined. No effect when unset (dev, CI verify).
2. `apps/admin/Dockerfile`: wire `ADMIN_ASSET_PREFIX` as a `--build-arg`, since `assetPrefix` is inlined at build time, not at runtime. Pattern: same as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` already does on `deploy.yml:148-149`.
3. CI sets `ADMIN_ASSET_PREFIX=https://<pullzone-hostname>` as a `build-arg` to the Docker build.

**Why no `generateBuildId`.** Next.js writes a `BUILD_ID` that appears in some asset URLs (`_next/static/<BUILD_ID>/_buildManifest.js`, `_next/data/<BUILD_ID>/…`). The server matches incoming requests against its own `BUILD_ID`. The research note (§B) flagged `generateBuildId = git SHA` as a guard against "image and CDN reference different `BUILD_ID`s." That guard exists for pipelines that build *twice* (host + Docker) and need to reconcile the two. We build *once* and extract the static dir from the same image, so the container's `BUILD_ID` and the uploaded `.next/static/<BUILD_ID>/…` paths are equal by construction. Adding `generateBuildId` would harden a process invariant we don't have.

### D. Smoke + verification

1. After deploy: curl `<assetPrefix>/_next/static/chunks/<some-known-chunk>.js` directly; verify 200 + `content-type: application/javascript` + `cdn-cache: HIT` on a repeat.
2. Curl `https://admin.wardrobe-assistants.ch/login` (or any page); confirm HTML references chunk URLs at the new `assetPrefix` hostname.
3. Manual: open `/my-bookings/<id>` in browser; reload twice; confirm no `ChunkLoadError`. Repeat across a deploy boundary if possible.
4. CSP smoke: open browser devtools; confirm no `Refused to load the script` errors and no `report-uri` violations from the chunk loads. (CSP report endpoint may not exist yet; visual console check is sufficient.)
5. Add a one-line check to `npm run smoke:public` (or a new `smoke:admin-static` script) that curls a known asset path on the new hostname.

### E. Defense in depth (optional but recommended)

1. On `admin_cdn` (the *app* pull zone, id 5798594), set the bunny "Cache Error Responses" toggle to **off** via Terraform — so even if some asset routing edge case slips through, a transient 404 doesn't pin for a year. This is the band-aid we discussed; doing it alongside the structural fix costs almost nothing.

## Out of scope

- **Custom hostname (`admin-static.wardrobe-assistants.ch`).** Use the b-cdn.net hostname for v1; revisit if a brand or pinning requirement emerges.
- **`/_next/image` / runtime image optimisation.** Stays on the app origin (it's a route handler, not a static asset). No change.
- **Public-folder assets (`/sw.js`, icons, manifest).** Stay on the app origin by design.
- **Old-chunk garbage collection.** Storage growth is negligible for v1; queue a TTL sweep as a follow-up iteration.
- **Migrating the homepage** — already uses storage-zone serving; nothing to do.

## Critical files

- `infra/terraform/storage.tf` (new resource)
- `infra/terraform/pullzones.tf` (new resource, possibly extend `admin_cdn` with the error-response toggle)
- `infra/terraform/outputs.tf` (export the new hostname)
- `infra/terraform/variables.tf` (if new vars are needed)
- `.github/workflows/deploy.yml` (new upload step + Docker `build-arg`)
- `apps/admin/next.config.ts` (assetPrefix wiring)
- `apps/admin/Dockerfile` (new ARG/ENV)
- `kb/admin-architecture/decision-log.md` (new ADR entry explaining the asset-decoupling rationale and the rejected alternatives above)

## Done when [6/8]

- [x] §A: TF code landed — `bunnynet_storage_zone.admin_static` + `bunnynet_pullzone.admin_static` with `prevent_destroy`, `strip_cookies = true`, 30-day expiration. *Runtime apply / hostname-curlable depends on `tofu apply` post-merge.*
- [x] §B: deploy workflow uploads `_next/static/` via `docker create` + `docker cp` extraction, then `ayeressian/bunnycdn-storage-deploy@v2.4.5` with `remove: "false"`, before the Magic Container roll. Secrets `BUNNY_ADMIN_STATIC_STORAGE_ZONE_NAME` + `BUNNY_ADMIN_STATIC_STORAGE_PASSWORD` referenced in YAML — configuring them in GitHub repo secrets is a deploy-time setup step.
- [x] §C: `assetPrefix` wired in `apps/admin/next.config.ts` (gated on `ADMIN_ASSET_PREFIX`); Dockerfile threads it as a build-arg; CI passes `vars.ADMIN_ASSET_PREFIX` into `docker build`. HTML inspection happens post-deploy.
- [x] §D: `scripts/smoke/admin-static-asset.sh` added + wired via `npm run smoke:admin-static`. Operator-precedence and regex-escape fixes from PR review applied. *Two-deploy reload-storm verification is a manual post-merge step.*
- [x] §E: `cache_errors = false` set on `bunnynet_pullzone.admin_cdn`.
- [x] ADR-023 added to `kb/admin-architecture/decision-log.md` documenting the structural fix and rejected alternatives.
- [x] `npm run verify` green; `npm run verify:tf` green (re-run post-review-fixes 2026-05-13).
- [ ] Post-deploy: no manual `hoppy pull-zone purge` required for at least one full week / N deploys. **Deferred — measurable only after merge + at least one production deploy cycle; tracked outside this PR.**

## §F — Pivot to same-origin edge rule (2026-05-13, post-merge)

The §A–E architecture above ships `assetPrefix` pointing at the static-asset pull-zone's b-cdn.net hostname. In production this immediately tripped CSP: admin's `style-src 'self' 'unsafe-inline'`, `font-src 'self'`, and `img-src 'self'` blocked every CSS/font/image asset on the CDN host. `'strict-dynamic'` only propagates trust within `script-src`; stylesheets, fonts, and images still need explicit host allowlists.

### What changed

- `apps/admin/next.config.ts` — dropped `ADMIN_ASSET_PREFIX` env-var read and the `assetPrefix` config entry. HTML emits relative `/_next/static/...` URLs.
- `apps/admin/Dockerfile` — dropped `ARG ADMIN_ASSET_PREFIX` + ENV passthrough.
- `.github/workflows/deploy.yml` — dropped the `ADMIN_ASSET_PREFIX` build-arg. Upload step retained (chunks still need to land in storage).
- `infra/terraform/pullzones.tf` — added `bunnynet_pullzone_edgerule.admin_static_assets` on the admin pull-zone. Trigger: `Url MatchAny https://admin.wardrobe-assistants.ch/_next/static/*`. Action: `OriginUrl` rewriting origin to `https://wardrobe-assistants-admin-static.b-cdn.net`. Bunny appends the request path, so every `_next/static/*` request transparently fetches from the admin-static pull-zone (which fronts the storage zone).
- `apps/admin/src/components/ZodClientInit.tsx` — new client component that calls `z.config({ jitless: true })` at module-load time, mounted in `app/layout.tsx`. Suppresses Zod v4's `new Function("")` JIT probe under the unchanged CSP. Caught throw is non-fatal but pollutes the console; jitless mode skips the probe entirely per Zod 4.4.0+ (PR `colinhacks/zod#5864`).
- GH variable `ADMIN_ASSET_PREFIX` deleted (unused).

### Why `OriginUrl` not `OriginStorage`

The bunny API rejects `OriginStorage` edge rules against pull-zones whose origin is a `ComputeContainer` (error: "Storage zone not valid"). Using `OriginUrl` pointed at the admin-static pull-zone's b-cdn.net hostname works — one extra bunny-internal hop, both edge layers cache, negligible cost.

### What the §A–E structural fix retained

The rolling-deploy cache-poisoning fix is unaffected. Chunks are still uploaded additively to the storage zone before each container roll. The admin-static pull-zone fronts that storage. The edge rule's effective origin always has the chunk regardless of which container instance is active. The original `ChunkLoadError` failure mode is structurally unreachable.

### Implementation surprises documented elsewhere

See [iteration-41-notes.md](./iteration-41-notes.md) for the full set of bugs we encountered during the same-day implementation (jq newline → 401, `--body -` literal → 1-char secret, turbopack red herring, the Zod JIT followup).

### Updates to ADR-023

`kb/admin-architecture/decision-log.md` ADR-023 has a "2026-05-13 update — §F pivot" subsection covering the same pivot with full rationale and rejected alternatives.
