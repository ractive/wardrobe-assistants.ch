import type { NextConfig } from "next";

// `headers()` is documented-unsupported under `output: "export"` (Next 16
// glossary: static export). The block stays here as the source-of-truth list
// of intended response headers, but **no edge enforcement is in place yet**:
// `infra/terraform/pullzones.tf` does not currently configure bunny.net edge
// rules to emit these headers. Edge enforcement is a deferred follow-up
// scoped to iter-16f (defense-in-depth). Until then, treat this list as
// intent-only — the homepage ships without security headers in production.
//
// CSP relaxed vs admin: Bunny Fonts (https://fonts.bunny.net) is the
// homepage's only third-party origin — `style-src` and `font-src` allow it.
// `img-src` is narrowed to https://*.b-cdn.net (Bunny CDN host pattern) and
// https://fonts.bunny.net rather than a blanket `https:` so a future XSS
// can't smuggle pixels through arbitrary third-party hosts. Add other CDNs
// here explicitly when an image source is introduced.
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
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: https://*.b-cdn.net https://fonts.bunny.net",
      "style-src 'self' 'unsafe-inline' https://fonts.bunny.net",
      "script-src 'self'",
      "font-src 'self' https://fonts.bunny.net",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "export",
  // bunny Pull Zone serves out/ directly. trailingSlash makes Next emit
  // services/index.html (rather than services.html) so /services and
  // /services/ both resolve cleanly without rewrites.
  trailingSlash: true,
  images: { unoptimized: true },
  reactCompiler: true,
};

export default nextConfig;

// Re-exported so the bunny-edge-rule terraform list (or any future smoke test)
// can stay in lockstep with the intended header set.
export { securityHeaders };
