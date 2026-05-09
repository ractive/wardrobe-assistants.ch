import type { NextConfig } from "next";

// Admin response surface — every route is session-bearing, no public/cacheable
// content. The `headers()` block below is the iter-16b edge-hardening
// belt-and-suspenders pair to `strip_cookies = true` on the admin pull-zone
// (infra/terraform/pullzones.tf). If a header regression slips through, the
// CDN side still won't cache cookies into the cache key.
//
// Cache-Control: `private, no-store, must-revalidate` covers Set-Cookie and
//   session-bearing bodies, irrespective of Better Auth's defaults. Scoped
//   to non-static paths via `ASSET_EXCLUDE_SOURCE` below — applying it to
//   `/_next/static/*` would override Next's immutable asset caching and
//   force a re-fetch of every JS/CSS chunk on every navigation.
// CSP: lives in `src/proxy.ts`, not here. Static `headers()` can't generate
//   a per-request nonce, and a strict `script-src 'self'` without a nonce
//   blocks Next.js's own bootstrap inline scripts (the `__next_r` request
//   ID, the framework manifest pointer, etc.). The proxy emits the CSP
//   dynamically with a fresh nonce per request; Next.js auto-stamps that
//   nonce onto its framework + page bundles. See `proxy.ts` for the
//   directive list.

// Catch-all that excludes Next's build-asset paths. Anything served from
// `_next/static` or `_next/image` is content-addressable and immutable; the
// app should not stamp `no-store` over it. Favicon kept out of the
// no-store rule for the same reason — bunny edge can cache it.
const ASSET_EXCLUDE_SOURCE = "/((?!_next/static|_next/image|favicon.ico).*)";

const cacheControlHeader = {
  key: "Cache-Control",
  value: "private, no-store, must-revalidate",
};

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Content-Security-Policy intentionally NOT set here — see comment block
  // at the top of this file. Emitted from `src/proxy.ts` per request.
];

const nextConfig: NextConfig = {
  // Standalone output: emits a self-contained server.js + minimal node_modules
  // under .next/standalone, suitable for the admin Magic Container image.
  output: "standalone",
  reactCompiler: true,
  // Trace from the workspace root so standalone packs @wardrobe-assistants/db
  // alongside the admin app.
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  async headers() {
    return [
      // Security headers apply to every response — they're harmless on
      // static assets and add CSP/X-Frame-Options coverage there too.
      { source: "/(.*)", headers: securityHeaders },
      // Cache-Control: no-store applies only to app/HTML responses. Static
      // assets keep Next's immutable defaults.
      {
        source: ASSET_EXCLUDE_SOURCE,
        headers: [cacheControlHeader],
      },
    ];
  },
};

export default nextConfig;

// Re-exported for smoke tests so the asserted list stays in lockstep with
// the configured list — one source of truth. `cacheControlHeader` is the
// app-route-only header; `securityHeaders` apply to every response.
export { ASSET_EXCLUDE_SOURCE, cacheControlHeader, securityHeaders };
