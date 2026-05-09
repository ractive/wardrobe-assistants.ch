import type { NextConfig } from "next";

// Admin response surface — every route is session-bearing, no public/cacheable
// content. The `headers()` block below is the iter-16b edge-hardening
// belt-and-suspenders pair to `strip_cookies = true` on the admin pull-zone
// (infra/terraform/pullzones.tf). If a header regression slips through, the
// CDN side still won't cache cookies into the cache key.
//
// Cache-Control: `private, no-store, must-revalidate` covers Set-Cookie and
//   session-bearing bodies, irrespective of Better Auth's defaults.
// CSP: starts permissive (`'unsafe-inline'` for styles is necessary because
//   Tailwind's runtime-injected styles + react-hook-form's inline error
//   styling don't ship with nonces in this stack). Tighten in a future
//   iteration once nonce/hash support is in place.
const securityHeaders = [
  { key: "Cache-Control", value: "private, no-store, must-revalidate" },
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
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
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
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

// Re-exported for smoke tests so the asserted list stays in lockstep with
// the configured list — one source of truth.
export { securityHeaders };
