# syntax=docker/dockerfile:1.7

# Build admin Next.js app from workspace root. `output: "standalone"` packs
# server.js + minimal node_modules so the runtime stage stays small.

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/marketing/package.json apps/marketing/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci -w apps/admin --include-workspace-root

FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
RUN npm -w apps/admin run build
# Generate Drizzle migrations alongside the build artefact so the runtime
# stage can apply them at boot.
RUN npm -w packages/db run db:generate || true

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output: server.js + bundled deps under .next/standalone.
COPY --from=builder /repo/apps/admin/.next/standalone ./
COPY --from=builder /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /repo/apps/admin/public ./apps/admin/public

# Migration runner + Drizzle SQL files
COPY --from=builder /repo/apps/admin/scripts ./apps/admin/scripts
COPY --from=builder /repo/packages/db/migrations ./packages/db/migrations
# tsx is needed to run scripts/migrate.ts at boot
RUN npm install --no-save --no-package-lock tsx@4.19.2

EXPOSE 3000
CMD ["sh", "-c", "node --import tsx apps/admin/scripts/migrate.ts && node apps/admin/server.js"]
