# syntax=docker/dockerfile:1.7

# Build admin Next.js app from workspace root. `output: "standalone"` packs
# server.js + minimal node_modules so the runtime stage stays small.

FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/homepage/package.json apps/homepage/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci -w apps/admin --include-workspace-root

FROM node:24-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
# Placeholder env for Next's build-time page-data collection. Runtime
# values come from the container env, not from this image — these never
# leak into the runner stage because ENV doesn't cross FROM boundaries.
#
# Shape must satisfy iter-13's prod env tripwires (lib/env.ts): NODE_ENV is
# auto-set to "production" by `next build`, which then requires
# - DATABASE_URL on a remote libsql:// scheme (not file:)
# - BETTER_AUTH_SECRET as 64 hex chars (32 bytes)
# These are placeholders only; runtime container env replaces them.
#
# Exception: NEXT_PUBLIC_VAPID_PUBLIC_KEY (iter-23 web push) is inlined into
# the client bundle by `next build`, so it MUST be its real value at build
# time — setting it on the runtime container has no effect. Plumbed in via
# build-arg from the deploy workflow (GH variable VAPID_PUBLIC_KEY). It's
# safe to bake in because the public half of a VAPID keypair is meant to be
# public; the private half stays in container runtime env only.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
# iter-41: serve `_next/static/` from a CDN-backed storage zone. `assetPrefix`
# is inlined at `next build` time (it bakes into the chunk manifest and the
# HTML emitted by SSR), so this MUST be a build-arg, not a runtime ENV. Empty
# default = no prefix (chunks served from origin) so local `docker build` and
# `npm run dev` keep working. CI sets it to the bunny pull-zone hostname.
ARG ADMIN_ASSET_PREFIX=""
ENV DATABASE_URL=libsql://build-placeholder.invalid \
    BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
    BETTER_AUTH_URL=https://admin.wardrobe-assistants.ch \
    RESEND_API_KEY=build-placeholder \
    EMAIL_FROM=admin@wardrobe-assistants.ch \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    ADMIN_ASSET_PREFIX=$ADMIN_ASSET_PREFIX \
    NEXT_TELEMETRY_DISABLED=1
RUN npm -w apps/admin run build

# Distroless runtime: no shell, no apk, no npm — just a pinned Node binary
# and our standalone bundle. This eliminates the recurring "vulnerable CLI
# bundled with the base image" class of Trivy findings (e.g. CVE-2026-33671
# in picomatch 4.0.3 inside npm's tinyglobby on node:24-alpine), since
# distroless ships nothing we don't need at runtime. server.js boots Node
# directly via the image's ENTRYPOINT.
#
# Using the `-debian13` (trixie) variant rather than `-debian12` (bookworm):
# the debian12 distroless image was lagging on rebuilds and shipping libssl3
# 3.0.18 against advisories fixed in 3.0.19 — Trivy on the post-merge build
# flagged 1× CRITICAL + 4× HIGH OpenSSL CVEs (CVE-2026-31789/28387/28388/
# 28389/28390). debian13 ships OpenSSL 3.5.x and tracks current Debian
# stable, so OS-level findings clear without the rebuild-lag tax. Equivalent
# to `gcr.io/distroless/nodejs24` — both tags currently point to the same
# digest, but naming the OS makes future bumps (debian14) obvious in diffs.
FROM gcr.io/distroless/nodejs24-debian13 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# iter-16b container hardening (audit C-SEC-06): drop root. Distroless ships
# a baked-in `nonroot` user (UID/GID 65532) so we just chown the COPY layers
# to it and switch USER below — no addgroup/adduser step (and no shell to
# run one in). Chowning at COPY-time avoids a duplicate-layer chown after.
COPY --from=builder --chown=nonroot:nonroot /repo/apps/admin/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nonroot:nonroot /repo/apps/admin/public ./apps/admin/public
# Drizzle migration journal + SQL files. apps/admin/src/lib/migrate.ts
# resolves the migrations folder relative to cwd at boot — keep this layout
# in sync with resolveMigrationsFolder()'s candidate list.
COPY --from=builder --chown=nonroot:nonroot /repo/packages/db/migrations ./packages/db/migrations

USER nonroot

EXPOSE 3000
# Migrations apply automatically on container boot via Next's instrumentation
# hook (apps/admin/src/instrumentation.ts → src/lib/migrate.ts). The hook runs
# inside the Next standalone server process, so drizzle-orm and @libsql/client
# resolve through the bundle's own node_modules tree (the resolution problem
# that defeated iter-09's CMD-wrapper approach).
#
# Set MIGRATE_ON_BOOT=false to bring up a container without touching schema
# (operator escape hatch for post-failure triage).
#
# CMD is just args here — the distroless image's ENTRYPOINT is `node`, so
# the runtime invocation is effectively `node apps/admin/server.js`.
CMD ["apps/admin/server.js"]
