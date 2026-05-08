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
ENV DATABASE_URL=libsql://build-placeholder.invalid \
    BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
    BETTER_AUTH_URL=https://admin.wardrobe-assistants.ch \
    RESEND_API_KEY=build-placeholder \
    EMAIL_FROM=admin@wardrobe-assistants.ch
RUN npm -w apps/admin run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output: server.js + bundled deps under .next/standalone.
COPY --from=builder /repo/apps/admin/.next/standalone ./
COPY --from=builder /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /repo/apps/admin/public ./apps/admin/public

EXPOSE 3000
# Migrations run as a separate operator step (npm -w apps/admin run migrate
# from a workstation with the libSQL URL + token), not at container boot.
# The runner image is a Next standalone bundle and intentionally does NOT
# carry tsx + drizzle-orm + @libsql/client in resolvable paths for the
# scripts/ directory — bundling those just to migrate-on-boot meant a 6×
# crash loop when the deps weren't where tsx expected them.
CMD ["node", "apps/admin/server.js"]
