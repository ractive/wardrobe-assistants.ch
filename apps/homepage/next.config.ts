import type { NextConfig } from "next";

// `headers()` is documented-unsupported under `output: "export"` (Next 16
// glossary: static export). The block stays here as the source-of-truth list
// of intended response headers; actual edge enforcement is mirrored by
// bunny.net edge rules on the homepage pull-zone (infra/terraform/pullzones.tf).
// If Next ever supports headers under static export, removing the bunny edge
// rules is the only follow-up.
//
// CSP relaxed vs admin: Bunny Fonts (https://fonts.bunny.net) is the
// homepage's only third-party origin — `style-src` and `font-src` allow it,
// and `img-src` allows https: for any Pencil-exported assets that resolve
// to the bunny CDN.
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
      "img-src 'self' data: https:",
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
